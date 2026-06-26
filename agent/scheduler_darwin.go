//go:build darwin

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// launchd label for our LaunchAgent.
const launchdLabel = "net.onewheelgeek.tokenwatch.agent"

// plistPath is ~/Library/LaunchAgents/<label>.plist.
func plistPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "Library", "LaunchAgents", launchdLabel+".plist"), nil
}

// installScheduler writes a LaunchAgent plist that runs `--once` on an
// interval, then loads it. We schedule via StartInterval (seconds) — simple and
// robust against clock weirdness.
func installScheduler(intervalSeconds int) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exe, _ = filepath.EvalSymlinks(exe)
	path, err := plistPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	plist := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>%s</string>
    <key>ProgramArguments</key>
    <array>
        <string>%s</string>
        <string>--once</string>
    </array>
    <key>StartInterval</key>
    <integer>%d</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>
`, launchdLabel, xmlEscape(exe), intervalSeconds)

	if err := os.WriteFile(path, []byte(plist), 0o644); err != nil {
		return err
	}
	// Reload if it was already loaded; ignore the unload error on first install.
	_ = exec.Command("launchctl", "unload", path).Run()
	if err := exec.Command("launchctl", "load", path).Run(); err != nil {
		return fmt.Errorf("launchctl load: %w", err)
	}
	fmt.Printf("Installed launchd agent %s (every %ds).\n", launchdLabel, intervalSeconds)
	return nil
}

// uninstallScheduler unloads and removes the LaunchAgent plist.
func uninstallScheduler() error {
	path, err := plistPath()
	if err != nil {
		return err
	}
	_ = exec.Command("launchctl", "unload", path).Run()
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	fmt.Printf("Removed launchd agent %s.\n", launchdLabel)
	return nil
}

// xmlEscape protects the executable path inside the plist.
func xmlEscape(s string) string {
	r := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;")
	return r.Replace(s)
}
