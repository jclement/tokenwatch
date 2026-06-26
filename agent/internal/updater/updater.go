// Package updater checks GitHub for newer releases and, on request, replaces
// the running binary in place. Everything is best-effort: a flaky network
// should never stop the agent from doing its actual job.
package updater

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// ErrHomebrew is returned by SelfUpdate when the running binary was installed by
// Homebrew — self-replacing a brew-managed file would desync the Cellar, so the
// user is told to `brew upgrade tokenwatch` instead.
var ErrHomebrew = errors.New("installed via Homebrew")

const (
	// latestURL is the GitHub "latest release" endpoint for the agent repo.
	latestURL = "https://api.github.com/repos/jclement/tokenwatch/releases/latest"
	userAgent = "tokenwatch-agent"
)

// Release is the slice of the GitHub release JSON we care about.
type Release struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		Name string `json:"name"`
		URL  string `json:"browser_download_url"`
	} `json:"assets"`
}

func httpClient() *http.Client { return &http.Client{Timeout: 20 * time.Second} }

// Latest fetches the most recent published release.
func Latest(ctx context.Context) (*Release, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, latestURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github returned %d", resp.StatusCode)
	}
	var rel Release
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&rel); err != nil {
		return nil, err
	}
	return &rel, nil
}

// CheckStale compares the running version to the latest release and returns the
// newer tag if one exists (empty string otherwise). Errors are swallowed into
// an empty result — staleness reporting is a nicety, not a guarantee.
func CheckStale(ctx context.Context, current string) string {
	rel, err := Latest(ctx)
	if err != nil || rel.TagName == "" {
		return ""
	}
	if isNewer(rel.TagName, current) {
		return rel.TagName
	}
	return ""
}

// isNewer reports whether tag (e.g. "v1.2.3") is a newer semantic version than
// current (e.g. "1.2.0" or "dev"). A "dev" build is always considered older so
// developers get the upgrade nudge. Non-numeric junk falls back to plain
// string inequality.
func isNewer(tag, current string) bool {
	if current == "" || current == "dev" {
		return true
	}
	a := parseVersion(tag)
	b := parseVersion(current)
	if a == nil || b == nil {
		return strings.TrimPrefix(tag, "v") != strings.TrimPrefix(current, "v")
	}
	for i := 0; i < 3; i++ {
		if a[i] != b[i] {
			return a[i] > b[i]
		}
	}
	return false
}

// parseVersion turns "v1.2.3" into [1,2,3]; returns nil if it doesn't look like one.
func parseVersion(s string) []int {
	s = strings.TrimPrefix(strings.TrimSpace(s), "v")
	parts := strings.SplitN(s, ".", 3)
	if len(parts) == 0 {
		return nil
	}
	out := make([]int, 3)
	for i := 0; i < 3; i++ {
		if i >= len(parts) {
			out[i] = 0
			continue
		}
		// Strip any pre-release suffix ("3-rc1" -> "3").
		num := parts[i]
		if dash := strings.IndexByte(num, '-'); dash >= 0 {
			num = num[:dash]
		}
		n, err := strconv.Atoi(num)
		if err != nil {
			return nil
		}
		out[i] = n
	}
	return out
}

// archiveName is the GoReleaser archive asset for this platform, e.g.
// "tokenwatch_darwin_arm64.tar.gz" (or "tokenwatch_windows_amd64.zip").
func archiveName() string {
	ext := "tar.gz"
	if runtime.GOOS == "windows" {
		ext = "zip"
	}
	return fmt.Sprintf("tokenwatch_%s_%s.%s", runtime.GOOS, runtime.GOARCH, ext)
}

// binaryName is the executable inside the archive.
func binaryName() string {
	if runtime.GOOS == "windows" {
		return "tokenwatch.exe"
	}
	return "tokenwatch"
}

// CleanupStaleBackup removes a leftover "<exe>.old" left by a previous Windows
// self-update. Safe at startup: once the new binary is running, the old file is
// no longer in use. No-op on non-Windows.
func CleanupStaleBackup() {
	if runtime.GOOS != "windows" {
		return
	}
	if exe, err := os.Executable(); err == nil {
		_ = os.Remove(exe + ".old")
	}
}

// IsHomebrew reports whether the running binary lives in a Homebrew Cellar
// (the symlink in <prefix>/bin resolves into .../Cellar/...). brew-managed
// binaries must be upgraded with `brew upgrade`, not self-replaced.
func IsHomebrew() bool {
	exe, err := os.Executable()
	if err != nil {
		return false
	}
	if real, err := filepath.EvalSymlinks(exe); err == nil {
		exe = real
	}
	return strings.Contains(exe, "/Cellar/")
}

// SelfUpdate downloads the latest release archive for this GOOS/GOARCH, extracts
// the binary, and atomically swaps it in for the running executable. Returns
// ErrHomebrew (without touching anything) for brew-managed installs.
func SelfUpdate(ctx context.Context) (string, error) {
	if IsHomebrew() {
		return "", ErrHomebrew
	}

	rel, err := Latest(ctx)
	if err != nil {
		return "", err
	}
	want := archiveName()
	var url string
	for _, a := range rel.Assets {
		if a.Name == want {
			url = a.URL
			break
		}
	}
	if url == "" {
		return "", fmt.Errorf("no release asset named %q in %s", want, rel.TagName)
	}

	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	// EvalSymlinks can fail on SUBST/UNC/junction paths or restricted parents;
	// fall back to the raw executable path rather than aborting the upgrade.
	if resolved, lerr := filepath.EvalSymlinks(exe); lerr == nil {
		exe = resolved
	}
	dir := filepath.Dir(exe)

	// Download the archive to a temp file (alongside the target so the final
	// rename stays on one filesystem), then extract the binary out of it.
	archivePath, err := download(ctx, url, dir)
	if err != nil {
		return "", err
	}
	defer os.Remove(archivePath)

	binTmp, err := extractBinary(archivePath, dir)
	if err != nil {
		return "", err
	}
	defer os.Remove(binTmp) // no-op once renamed away
	if err := os.Chmod(binTmp, 0o755); err != nil {
		return "", err
	}

	// On Windows you can't replace a running .exe directly; rename the old one
	// out of the way first, then move the new one into place.
	if runtime.GOOS == "windows" {
		old := exe + ".old"
		_ = os.Remove(old)
		if err := os.Rename(exe, old); err != nil {
			return "", err
		}
		if err := os.Rename(binTmp, exe); err != nil {
			_ = os.Rename(old, exe) // best-effort rollback
			return "", err
		}
		// The ".old" file is the now-renamed running image and usually can't be
		// deleted until this process exits; CleanupStaleBackup() clears it on the
		// next run. Try once anyway in case the OS allows it.
		_ = os.Remove(old)
		return rel.TagName, nil
	}

	if err := os.Rename(binTmp, exe); err != nil {
		return "", err
	}
	return rel.TagName, nil
}

// download fetches url into a temp file in dir and returns its path.
func download(ctx context.Context, url, dir string) (string, error) {
	tmp, err := os.CreateTemp(dir, ".tokenwatch-archive-*")
	if err != nil {
		return "", err
	}
	tmpPath := tmp.Name()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		return "", err
	}
	req.Header.Set("User-Agent", userAgent)
	resp, err := httpClient().Do(req)
	if err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		tmp.Close()
		os.Remove(tmpPath)
		return "", fmt.Errorf("download returned %d", resp.StatusCode)
	}
	if _, err := io.Copy(tmp, resp.Body); err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		return "", err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpPath)
		return "", err
	}
	return tmpPath, nil
}

// extractBinary pulls the tokenwatch executable out of a .tar.gz (or .zip on
// Windows) archive into a temp file in dir and returns its path.
func extractBinary(archivePath, dir string) (string, error) {
	want := binaryName()
	if runtime.GOOS == "windows" {
		return extractFromZip(archivePath, want, dir)
	}

	f, err := os.Open(archivePath)
	if err != nil {
		return "", err
	}
	defer f.Close()
	gz, err := gzip.NewReader(f)
	if err != nil {
		return "", err
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", err
		}
		if filepath.Base(hdr.Name) == want {
			return writeToTemp(tr, dir)
		}
	}
	return "", fmt.Errorf("binary %q not found in archive", want)
}

// extractFromZip is the Windows path (release archives are .zip there).
func extractFromZip(archivePath, want, dir string) (string, error) {
	zr, err := zip.OpenReader(archivePath)
	if err != nil {
		return "", err
	}
	defer zr.Close()
	for _, zf := range zr.File {
		if filepath.Base(zf.Name) != want {
			continue
		}
		rc, err := zf.Open()
		if err != nil {
			return "", err
		}
		defer rc.Close()
		return writeToTemp(rc, dir)
	}
	return "", fmt.Errorf("binary %q not found in archive", want)
}

// writeToTemp copies r into a fresh temp file in dir and returns its path.
func writeToTemp(r io.Reader, dir string) (string, error) {
	out, err := os.CreateTemp(dir, ".tokenwatch-upgrade-*")
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(out, r); err != nil {
		out.Close()
		os.Remove(out.Name())
		return "", err
	}
	if err := out.Close(); err != nil {
		os.Remove(out.Name())
		return "", err
	}
	return out.Name(), nil
}
