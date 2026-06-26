//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
)

const taskName = "TokenWatchAgent"

// installScheduler registers a Scheduled Task via schtasks that runs `--once`
// every N minutes. schtasks works in minutes, so we round the interval up.
func installScheduler(intervalSeconds int) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exe, _ = filepath.EvalSymlinks(exe)

	minutes := intervalSeconds / 60
	if minutes < 1 {
		minutes = 1
	}

	// /F overwrites an existing task; quoting the binary path guards spaces.
	args := []string{
		"/Create", "/F",
		"/SC", "MINUTE",
		"/MO", strconv.Itoa(minutes),
		"/TN", taskName,
		"/TR", fmt.Sprintf(`"%s" --once`, exe),
	}
	cmd := exec.Command("schtasks", args...)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("schtasks create: %w: %s", err, string(out))
	}
	fmt.Printf("Installed scheduled task %s (every %dm).\n", taskName, minutes)
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
