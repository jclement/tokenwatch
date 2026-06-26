//go:build linux

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const systemdUnit = "tokenwatch-agent"

// systemdDir is ~/.config/systemd/user, where --user units live.
func systemdDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "systemd", "user"), nil
}

// installScheduler prefers a systemd --user timer; if systemctl isn't around
// (minimal containers, non-systemd distros) it falls back to crontab.
func installScheduler(intervalSeconds int) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exe, _ = filepath.EvalSymlinks(exe)

	if _, err := exec.LookPath("systemctl"); err == nil {
		return installSystemd(exe, intervalSeconds)
	}
	return installCron(exe, intervalSeconds)
}

func installSystemd(exe string, intervalSeconds int) error {
	dir, err := systemdDir()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	service := fmt.Sprintf(`[Unit]
Description=TokenWatch ingestion agent (one-shot)

[Service]
Type=oneshot
ExecStart=%s --once
`, exe)

	timer := fmt.Sprintf(`[Unit]
Description=Run TokenWatch agent periodically

[Timer]
OnBootSec=1min
OnUnitActiveSec=%ds
Persistent=true

[Install]
WantedBy=timers.target
`, intervalSeconds)

	if err := os.WriteFile(filepath.Join(dir, systemdUnit+".service"), []byte(service), 0o644); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dir, systemdUnit+".timer"), []byte(timer), 0o644); err != nil {
		return err
	}

	_ = exec.Command("systemctl", "--user", "daemon-reload").Run()
	if err := exec.Command("systemctl", "--user", "enable", "--now", systemdUnit+".timer").Run(); err != nil {
		return fmt.Errorf("systemctl enable timer: %w", err)
	}
	fmt.Printf("Installed systemd --user timer %s (every %ds).\n", systemdUnit, intervalSeconds)
	return nil
}

// cronMarker tags the lines we own so we can find and replace them cleanly.
const cronMarker = "# tokenwatch-agent"

func installCron(exe string, intervalSeconds int) error {
	minutes := intervalSeconds / 60
	if minutes < 1 {
		minutes = 1
	}
	spec := "* * * * *"
	if minutes > 1 {
		spec = fmt.Sprintf("*/%d * * * *", minutes)
	}
	line := fmt.Sprintf("%s %s --once %s", spec, exe, cronMarker)

	existing, _ := exec.Command("crontab", "-l").Output()
	lines := stripCronMarker(string(existing))
	lines = append(lines, line)
	newTab := strings.Join(lines, "\n") + "\n"

	cmd := exec.Command("crontab", "-")
	cmd.Stdin = strings.NewReader(newTab)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("install crontab: %w", err)
	}
	fmt.Printf("Installed crontab entry (every %dm).\n", minutes)
	return nil
}

// uninstallScheduler removes whichever mechanism we installed.
func uninstallScheduler() error {
	if _, err := exec.LookPath("systemctl"); err == nil {
		_ = exec.Command("systemctl", "--user", "disable", "--now", systemdUnit+".timer").Run()
		dir, err := systemdDir()
		if err == nil {
			_ = os.Remove(filepath.Join(dir, systemdUnit+".timer"))
			_ = os.Remove(filepath.Join(dir, systemdUnit+".service"))
			_ = exec.Command("systemctl", "--user", "daemon-reload").Run()
		}
	}
	// Also scrub any crontab line we may have left.
	existing, _ := exec.Command("crontab", "-l").Output()
	lines := stripCronMarker(string(existing))
	newTab := strings.Join(lines, "\n")
	if strings.TrimSpace(newTab) != "" {
		newTab += "\n"
	}
	cmd := exec.Command("crontab", "-")
	cmd.Stdin = strings.NewReader(newTab)
	_ = cmd.Run()

	fmt.Println("Removed TokenWatch scheduler entries.")
	return nil
}

// stripCronMarker drops our own lines (and blanks) from a crontab dump.
func stripCronMarker(tab string) []string {
	var out []string
	for _, l := range strings.Split(tab, "\n") {
		if strings.Contains(l, cronMarker) || strings.TrimSpace(l) == "" {
			continue
		}
		out = append(out, l)
	}
	return out
}
