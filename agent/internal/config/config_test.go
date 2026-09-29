package config

import (
	"os"
	"path/filepath"
	"testing"
)

// A config written by an older parser loses its fingerprints on load, so
// every log is re-read once; a current one keeps them.
func TestLoadDropsFingerprintsFromOlderParser(t *testing.T) {
	for _, tc := range []struct {
		name    string
		version int
		keep    bool
	}{
		{"older parser", ParseVersion - 1, false},
		{"current parser", ParseVersion, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			t.Setenv("HOME", dir)
			t.Setenv("XDG_CONFIG_HOME", dir)
			t.Setenv("AppData", dir)
			p, err := Path()
			if err != nil {
				t.Fatal(err)
			}
			c := &Config{ServerURL: "x", ParseVersion: tc.version, path: p,
				FileFingerprints: map[string]Fingerprint{filepath.Join(dir, "a.jsonl"): {ModMs: 1, Size: 2}}}
			if err := c.Save(); err != nil {
				t.Fatal(err)
			}
			got, err := Load()
			if err != nil {
				t.Fatal(err)
			}
			if kept := len(got.FileFingerprints) == 1; kept != tc.keep {
				t.Fatalf("fingerprints kept = %v, want %v", kept, tc.keep)
			}
			if got.ParseVersion != ParseVersion {
				t.Fatalf("ParseVersion = %d", got.ParseVersion)
			}
			_ = os.Remove(p)
		})
	}
}
