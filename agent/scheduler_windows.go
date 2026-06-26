//go:build windows

package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

const taskName = "TokenWatchAgent"

// stableExeDir is a per-user location the scheduled task can rely on, separate
// from wherever the user first extracted the download (which they may delete).
func stableExeDir() string {
	if base := os.Getenv("LOCALAPPDATA"); base != "" {
		return filepath.Join(base, "TokenWatch")
	}
	base, _ := os.UserConfigDir()
	return filepath.Join(base, "TokenWatch")
}

// copyExe copies the running binary to dst (atomic via temp+rename).
func copyExe(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	tmp := dst + ".new"
	out, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o755)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		os.Remove(tmp)
		return err
	}
	if err := out.Close(); err != nil {
		os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, dst)
}

// installScheduler copies the agent to a stable location and registers a
// Scheduled Task (schtasks) that runs `--once` every N minutes from there.
func installScheduler(intervalSeconds int) error {
	cur, err := os.Executable()
	if err != nil {
		return err
	}
	if resolved, lerr := filepath.EvalSymlinks(cur); lerr == nil {
		cur = resolved
	}

	// Pin a stable copy so deleting the download folder can't break the task.
	target := filepath.Join(stableExeDir(), "tokenwatch.exe")
	if !strings.EqualFold(cur, target) {
		if err := copyExe(cur, target); err != nil {
			return fmt.Errorf("copying agent to %s: %w", target, err)
		}
	}

	// schtasks works in whole minutes; round the interval up.
	minutes := (intervalSeconds + 59) / 60
	if minutes < 1 {
		minutes = 1
	}

	// /F overwrites an existing task; quoting the binary path guards spaces.
	args := []string{
		"/Create", "/F",
		"/SC", "MINUTE",
		"/MO", strconv.Itoa(minutes),
		"/TN", taskName,
		"/TR", fmt.Sprintf(`"%s" --once`, target),
	}
	cmd := exec.Command("schtasks", args...)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("schtasks create: %w: %s", err, string(out))
	}
	fmt.Printf("Installed scheduled task %s (every %dm), running %s.\n", taskName, minutes, target)
	fmt.Println("It runs from that stable copy — you can delete the folder you extracted into.")
	return nil
}

// uninstallScheduler deletes the scheduled task.
func uninstallScheduler() error {
	cmd := exec.Command("schtasks", "/Delete", "/F", "/TN", taskName)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("schtasks delete: %w: %s", err, string(out))
	}
	fmt.Printf("Removed scheduled task %s.\n", taskName)
	return nil
}
