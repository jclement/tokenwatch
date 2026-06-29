package tui

import (
	"strings"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/jclement/tokenwatch/agent/internal/config"
)

func keyMsg(s string) tea.KeyMsg { return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(s)} }

// sampleModel builds a model at a given size with some data and returns it.
func sampleModel(w, h int) model {
	m := newModel(&config.Config{ServerURL: "https://tokens.onewheelgeek.net", DeviceToken: "dev.tok"}, "1.2.3", 5*time.Minute)
	m.scanning = false // initial scan considered done for rendering tests
	m.w, m.h = w, h
	mm, _ := m.Update(scanMsg{
		agg: map[string]*modelStat{
			"claude-opus-4":   {engine: "Claude", tokens: 82_100_000},
			"claude-sonnet-4": {engine: "Claude", tokens: 21_000_000},
			"gpt-5":           {engine: "Codex", tokens: 9_300_000},
		},
		files: 12,
	})
	return mm.(model)
}

func TestViewRendersWithoutPanic(t *testing.T) {
	for _, sz := range [][2]int{{120, 40}, {80, 24}, {40, 12}, {10, 5}, {0, 0}} {
		m := sampleModel(sz[0], sz[1])
		out := m.View()
		if out == "" {
			t.Fatalf("empty view at %dx%d", sz[0], sz[1])
		}
		if !strings.Contains(stripANSI(out), "Tokens by model") {
			t.Fatalf("histograph title missing at %dx%d", sz[0], sz[1])
		}
	}
}

func TestEmptyHistograph(t *testing.T) {
	m := newModel(&config.Config{ServerURL: "https://x"}, "dev", time.Minute)
	m.scanning = false
	m.w, m.h = 90, 30
	if out := m.View(); !strings.Contains(stripANSI(out), "no token usage") {
		t.Fatal("expected empty-state hint in histograph")
	}
}

func TestAutoSyncScheduling(t *testing.T) {
	m := newModel(&config.Config{ServerURL: "https://x", DeviceToken: "tok"}, "dev", 5*time.Minute)
	m.scanning = false
	m.now = time.Now()

	if !m.dueForSync() {
		t.Fatal("should sync immediately on launch (zero lastSync)")
	}
	m.lastSync = m.now
	if m.dueForSync() {
		t.Fatal("should not sync again right after a sync")
	}
	m.now = m.lastSync.Add(6 * time.Minute)
	if !m.dueForSync() {
		t.Fatal("should sync once the interval has elapsed")
	}
	// toggling auto off via the 'a' key
	mm, _ := m.Update(keyMsg("a"))
	if mm.(model).autoOn {
		t.Fatal("'a' should toggle auto-sync off")
	}
}

func TestPushFoldsIntoHistograph(t *testing.T) {
	m := sampleModel(100, 30)
	before := m.agg["gpt-5"].tokens
	mm, _ := m.Update(pushMsg{
		recv: 3, ins: 3, events: 3, tokens: 700_000,
		byModel: map[string]int{"gpt-5": 700_000},
		engines: map[string]string{"gpt-5": "Codex"},
		files:   12,
	})
	m2 := mm.(model)
	if got := m2.agg["gpt-5"].tokens; got != before+700_000 {
		t.Fatalf("push not folded: got %d want %d", got, before+700_000)
	}
	if m2.sessEvents != 3 || m2.sessTokens != 700_000 {
		t.Fatalf("session counters wrong: %d events, %d tokens", m2.sessEvents, m2.sessTokens)
	}
}

func TestDissolveRunsToCompletion(t *testing.T) {
	m := sampleModel(100, 30)
	dm, cmd := m.startDissolve()
	m = dm.(model)
	if !m.dissolving || cmd == nil {
		t.Fatal("dissolve did not start")
	}
	// Every frame must render without panicking.
	for i := 0; i <= dissolveFrames+2; i++ {
		_ = m.View()
		nm, _ := m.Update(dissolveMsg{})
		m = nm.(model)
	}
}
