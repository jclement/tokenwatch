// Command tokenwatch-agent reads the local Claude Code and Codex logs, extracts
// sanitized token-usage and confessional stats, and pushes them to a TokenWatch
// server. It never transmits raw text or file paths — just numbers and opaque,
// one-way-hashed ids. It is the cross-platform replacement for the macOS app's
// local parser.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/jclement/tokenwatch/agent/internal/client"
	"github.com/jclement/tokenwatch/agent/internal/config"
	"github.com/jclement/tokenwatch/agent/internal/parser"
	"github.com/jclement/tokenwatch/agent/internal/updater"
)

// Version is stamped at build time via -ldflags "-X main.Version=v1.2.3".
var Version = "dev"

func main() {
	var (
		once            = flag.Bool("once", false, "scan once, push, and exit (default behavior)")
		continuous      = flag.Bool("continuous", false, "loop forever, pushing only new/changed files")
		interval        = flag.Duration("interval", 5*time.Minute, "poll interval for --continuous")
		pair            = flag.String("pair", "", "exchange a pairing CODE for a device token, then exit")
		install         = flag.Bool("install", false, "install an OS scheduler entry that runs --once periodically")
		uninstall       = flag.Bool("uninstall", false, "remove the OS scheduler entry")
		upgrade         = flag.Bool("upgrade", false, "download and install the latest release for this platform")
		urlOverride     = flag.String("url", "", "override server base URL (default from config or "+config.DefaultServerURL+")")
		shareSwearWords = flag.Bool("share-swear-words", false, "include per-word swear tallies in uploads")
		showVersion     = flag.Bool("version", false, "print version and exit")
		name            = flag.String("name", "", "device name for pairing (default: hostname)")
	)
	flag.Parse()

	if *showVersion {
		fmt.Println(Version)
		return
	}

	cfg, err := config.Load()
	if err != nil {
		fail("loading config: %v", err)
	}
	if *urlOverride != "" {
		cfg.ServerURL = *urlOverride
	}

	ctx := context.Background()

	switch {
	case *upgrade:
		runUpgrade(ctx)
	case *pair != "":
		runPair(ctx, cfg, *pair, *name)
	case *install:
		if err := installScheduler(int(interval.Seconds())); err != nil {
			fail("install: %v", err)
		}
	case *uninstall:
		if err := uninstallScheduler(); err != nil {
			fail("uninstall: %v", err)
		}
	case *continuous:
		runContinuous(ctx, cfg, *interval, *shareSwearWords)
	default:
		// --once is the implicit default. The unused *once is read here so the
		// flag still documents the behavior in --help.
		_ = *once
		maybeNotifyStale(ctx)
		if err := scanAndPush(ctx, cfg, *shareSwearWords); err != nil {
			fail("%v", err)
		}
	}
}

// runUpgrade self-updates the binary in place — unless it was installed by
// Homebrew, in which case brew owns the binary and should do the upgrade.
func runUpgrade(ctx context.Context) {
	if updater.IsHomebrew() {
		fmt.Println("Installed via Homebrew — upgrade with:\n  brew upgrade tokenwatch")
		return
	}
	fmt.Println("Checking for a newer release…")
	tag, err := updater.SelfUpdate(ctx)
	if errors.Is(err, updater.ErrHomebrew) {
		fmt.Println("Installed via Homebrew — upgrade with:\n  brew upgrade tokenwatch")
		return
	}
	if err != nil {
		fail("upgrade: %v", err)
	}
	fmt.Printf("Upgraded to %s. Re-run the agent to use it.\n", tag)
}

// runPair trades a pairing code for a device token and stores it.
func runPair(ctx context.Context, cfg *config.Config, code, name string) {
	if name == "" {
		if h, err := os.Hostname(); err == nil {
			name = h
		} else {
			name = "unknown-host"
		}
	}
	c := client.New(cfg.ServerURL, "", Version)
	token, err := c.Pair(ctx, code, name, runtime.GOOS, runtime.GOARCH)
	if err != nil {
		fail("pairing: %v", err)
	}
	cfg.DeviceToken = token
	if err := cfg.Save(); err != nil {
		fail("saving device token: %v", err)
	}
	fmt.Printf("Paired as %q. Device token saved.\n", name)
}

// runContinuous loops, scanning and pushing on each tick. The first scan runs
// immediately so the agent does useful work without waiting a full interval.
func runContinuous(ctx context.Context, cfg *config.Config, interval time.Duration, shareSwearWords bool) {
	maybeNotifyStale(ctx)
	fmt.Printf("Running continuously (every %s). Ctrl-C to stop.\n", interval)
	for {
		if err := scanAndPush(ctx, cfg, shareSwearWords); err != nil {
			fmt.Fprintf(os.Stderr, "scan: %v\n", err)
		}
		time.Sleep(interval)
	}
}

// scanAndPush enumerates the logs, parses every new/changed file, uploads the
// resulting events, and records fingerprints so unchanged files are skipped
// next time. The server dedups, so even a re-scan of everything is harmless —
// fingerprints are purely an efficiency win.
func scanAndPush(ctx context.Context, cfg *config.Config, shareSwearWords bool) error {
	if cfg.DeviceToken == "" {
		return fmt.Errorf("not paired — run with --pair <CODE> first")
	}

	p := parser.New()
	files := p.Enumerate()

	var events []parser.IngestEvent
	pending := map[string]config.Fingerprint{}
	scanned := 0

	for _, ref := range files {
		fp, err := config.FingerprintOf(ref.Path)
		if err != nil {
			continue // file vanished mid-scan; ignore
		}
		if cfg.Unchanged(ref.Path, fp) {
			continue // identical mod-time + size since last run — skip the read
		}
		events = append(events, p.ParseFile(ref, shareSwearWords)...)
		pending[ref.Path] = fp
		scanned++
	}

	if len(events) == 0 {
		fmt.Printf("Nothing new (%d files, all unchanged).\n", len(files))
		return nil
	}

	c := client.New(cfg.ServerURL, cfg.DeviceToken, Version)
	resp, err := c.Ingest(ctx, events)
	if err != nil {
		return err // don't record fingerprints — we'll retry these files next run
	}

	// Upload succeeded: commit the fingerprints so we don't re-read these files.
	for path, fp := range pending {
		cfg.Remember(path, fp)
	}
	if err := cfg.Save(); err != nil {
		return fmt.Errorf("saving fingerprints: %w", err)
	}

	fmt.Printf("Pushed %d events from %d file(s): received=%d inserted=%d.\n",
		len(events), scanned, resp.Received, resp.Inserted)
	return nil
}

// maybeNotifyStale prints a one-line nudge if a newer release exists. Best
// effort: network failures are silent.
func maybeNotifyStale(ctx context.Context) {
	cctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if tag := updater.CheckStale(cctx, Version); tag != "" {
		how := "Run --upgrade."
		if updater.IsHomebrew() {
			how = "Run: brew upgrade tokenwatch"
		}
		fmt.Fprintf(os.Stderr, "A newer agent is available (%s, you have %s). %s\n", tag, Version, how)
	}
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "error: "+format+"\n", args...)
	os.Exit(1)
}
