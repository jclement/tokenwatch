// Package config persists the agent's tiny bit of state: where the server is,
// the device token earned by pairing, and per-file fingerprints so continuous
// runs can skip files that haven't changed since last time.
package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// DefaultServerURL is where uploads go unless overridden with --url.
const DefaultServerURL = "https://tokens.onewheelgeek.net"

// Fingerprint is the cheap "has this file changed?" key: modification time in
// milliseconds plus size in bytes. Mirrors the Swift `files` table columns.
type Fingerprint struct {
	ModMs int64 `json:"modMs"`
	Size  int64 `json:"size"`
}

// Config is the whole on-disk state, stored as one JSON file.
type Config struct {
	ServerURL        string                 `json:"serverURL"`
	DeviceToken      string                 `json:"deviceToken"`
	FileFingerprints map[string]Fingerprint `json:"fileFingerprints"`

	// path is where this config was loaded from / will be saved to. Not serialized.
	path string `json:"-"`
}

// Dir returns the config directory (created on demand by Save):
// <UserConfigDir>/tokenwatch.
func Dir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "tokenwatch"), nil
}

// Path returns the full path to config.json.
func Path() (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "config.json"), nil
}

// Load reads the config, returning a sensible default if none exists yet. It
// never errors on a missing file — a fresh agent just has nothing to remember.
func Load() (*Config, error) {
	path, err := Path()
	if err != nil {
		return nil, err
	}
	c := &Config{
		ServerURL:        DefaultServerURL,
		FileFingerprints: map[string]Fingerprint{},
		path:             path,
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return c, nil
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(data, c); err != nil {
		return nil, err
	}
	c.path = path
	if c.ServerURL == "" {
		c.ServerURL = DefaultServerURL
	}
	if c.FileFingerprints == nil {
		c.FileFingerprints = map[string]Fingerprint{}
	}
	return c, nil
}

// Save writes the config back atomically (write-temp-then-rename) so a crash
// mid-write can't leave a truncated file.
func (c *Config) Save() error {
	if c.path == "" {
		p, err := Path()
		if err != nil {
			return err
		}
		c.path = p
	}
	if err := os.MkdirAll(filepath.Dir(c.path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	tmp := c.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil { // 0600: token is a secret
		return err
	}
	return os.Rename(tmp, c.path)
}

// normKey canonicalizes a path used as a fingerprint key. On Windows, paths are
// case-insensitive and separators can vary, so we clean + lowercase to avoid
// drive-letter / casing drift (e.g. across the install vs the scheduled-task
// account) causing redundant re-scans and unbounded config growth.
func normKey(path string) string {
	p := filepath.Clean(path)
	if runtime.GOOS == "windows" {
		p = strings.ToLower(p)
	}
	return p
}

// Unchanged reports whether the file at path matches its stored fingerprint —
// the signal to skip re-reading it on a continuous pass.
func (c *Config) Unchanged(path string, fp Fingerprint) bool {
	old, ok := c.FileFingerprints[normKey(path)]
	return ok && old == fp
}

// Remember records a file's current fingerprint.
func (c *Config) Remember(path string, fp Fingerprint) {
	if c.FileFingerprints == nil {
		c.FileFingerprints = map[string]Fingerprint{}
	}
	c.FileFingerprints[normKey(path)] = fp
}

// FingerprintOf computes the fingerprint for a file on disk.
func FingerprintOf(path string) (Fingerprint, error) {
	info, err := os.Stat(path)
	if err != nil {
		return Fingerprint{}, err
	}
	return Fingerprint{
		ModMs: info.ModTime().UnixMilli(),
		Size:  info.Size(),
	}, nil
}
