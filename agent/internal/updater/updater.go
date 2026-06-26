// Package updater checks GitHub for newer releases and, on request, replaces
// the running binary in place. Everything is best-effort: a flaky network
// should never stop the agent from doing its actual job.
package updater

import (
	"context"
	"encoding/json"
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

// assetName is the release-asset filename we expect for this platform, e.g.
// "tokenwatch-agent-linux-arm64" (or "...-windows-amd64.exe").
func assetName() string {
	name := fmt.Sprintf("tokenwatch-agent-%s-%s", runtime.GOOS, runtime.GOARCH)
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	return name
}

// SelfUpdate downloads the latest release binary for this GOOS/GOARCH and
// atomically swaps it in for the running executable.
func SelfUpdate(ctx context.Context) (string, error) {
	rel, err := Latest(ctx)
	if err != nil {
		return "", err
	}
	want := assetName()
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
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return "", err
	}

	// Download to a temp file alongside the target so the rename stays on the
	// same filesystem (cross-device renames fail).
	dir := filepath.Dir(exe)
	tmp, err := os.CreateTemp(dir, ".tokenwatch-upgrade-*")
	if err != nil {
		return "", err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath) // no-op once renamed away

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		tmp.Close()
		return "", err
	}
	req.Header.Set("User-Agent", userAgent)
	resp, err := httpClient().Do(req)
	if err != nil {
		tmp.Close()
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		tmp.Close()
		return "", fmt.Errorf("download returned %d", resp.StatusCode)
	}
	if _, err := io.Copy(tmp, resp.Body); err != nil {
		tmp.Close()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}
	if err := os.Chmod(tmpPath, 0o755); err != nil {
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
		if err := os.Rename(tmpPath, exe); err != nil {
			_ = os.Rename(old, exe) // best-effort rollback
			return "", err
		}
		return rel.TagName, nil
	}

	if err := os.Rename(tmpPath, exe); err != nil {
		return "", err
	}
	return rel.TagName, nil
}
