package parser

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/jclement/tokenwatch/agent/internal/textanalysis"
)

// Inline fixtures: a couple of real-shaped Claude lines and a Codex line. Kept
// tiny on purpose; the point is to lock in the dedup-id rules and the token
// math against the Swift reference.

const claudeJSONL = `{"type":"user","timestamp":"2024-01-02T15:04:05.000Z","sessionId":"sess-abc","message":{"content":"please fix this damn bug, thanks"}}
{"type":"assistant","timestamp":"2024-01-02T15:04:06.000Z","sessionId":"sess-abc","requestId":"req-1","message":{"id":"msg_123","model":"claude-sonnet-4","content":[{"type":"text","text":"You're right, good catch. I apologize for the mistake."}],"usage":{"input_tokens":10,"cache_read_input_tokens":5,"cache_creation_input_tokens":2,"output_tokens":20}}}
{"type":"assistant","timestamp":"2024-01-02T15:05:00.000Z","sessionId":"sess-abc","message":{"model":"claude-3-5-synthetic","content":"ignored","usage":{"input_tokens":99,"output_tokens":99}}}
{"type":"assistant","timestamp":"2024-01-02T15:06:00.000Z","sessionId":"sess-abc","message":{"model":"claude-sonnet-4","content":"empty usage","usage":{"input_tokens":0,"output_tokens":0}}}
`

const codexJSONL = `{"timestamp":"2024-01-02T16:00:00.000Z","payload":{"type":"session_meta","model":"gpt-5-codex"}}
{"timestamp":"2024-01-02T16:01:00.000Z","payload":{"type":"token_count","info":{"last_token_usage":{"input_tokens":100,"cached_input_tokens":30,"output_tokens":40}}}}
{"timestamp":"2024-01-02T16:02:00.000Z","payload":{"type":"token_count","info":{"last_token_usage":{"input_tokens":0,"cached_input_tokens":0,"output_tokens":0}}}}
{"timestamp":"2024-01-02T16:03:00.000Z","payload":{"type":"token_count","info":{"last_token_usage":{"input_tokens":50,"cached_input_tokens":10,"output_tokens":5}}}}
`

func writeFixture(t *testing.T, dir, name, body string) string {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestParseClaude(t *testing.T) {
	dir := t.TempDir()
	path := writeFixture(t, dir, "session.jsonl", claudeJSONL)

	events := parseClaude(path, true)

	// Expected events:
	//   1. user text     (swears=1 "damn", polite=2 "please"/"thanks")
	//   2. assistant usage (msg_123, tokens)
	//   3. assistant text  (agreed=2 you're right/good catch, sorry=1 i apologize)
	// The synthetic-model line is skipped (model contains "synthetic").
	// The zero-usage assistant line yields no usage event, but its content
	// "empty usage" still produces a (zeroed) bot text event.
	var usage, userText, botText *IngestEvent
	for i := range events {
		e := &events[i]
		switch {
		case e.total() > 0:
			usage = e
		case e.Swears > 0 || e.Polite > 0:
			userText = e
		case e.Agreed > 0 || e.Sorry > 0:
			botText = e
		}
	}

	if usage == nil {
		t.Fatal("no usage event produced")
	}
	// Token math straight from message.usage.
	if usage.Input != 10 || usage.CacheRead != 5 || usage.CacheCreate != 2 || usage.Output != 20 {
		t.Errorf("token math wrong: %+v", usage)
	}
	// Dedup id for an assistant usage turn is message.id.
	if usage.ID != "msg_123" {
		t.Errorf("usage id = %q, want msg_123", usage.ID)
	}
	if usage.Session != "sess-abc" {
		t.Errorf("session = %q, want sess-abc", usage.Session)
	}
	if usage.Model != "claude-sonnet-4" {
		t.Errorf("model = %q", usage.Model)
	}

	if userText == nil {
		t.Fatal("no user text event")
	}
	if userText.Swears != 1 || userText.Polite != 2 {
		t.Errorf("user counts wrong: swears=%d polite=%d", userText.Swears, userText.Polite)
	}
	if userText.SwearWords["damn"] != 1 {
		t.Errorf("swearWords = %+v, want damn:1", userText.SwearWords)
	}
	// Dedup id for a user turn is the FNV hash of "<ts>|u|<first 300 chars>".
	wantUserID := textanalysis.StableID("1704207845.0|u|please fix this damn bug, thanks")
	if userText.ID != wantUserID {
		t.Errorf("user id = %q, want %q", userText.ID, wantUserID)
	}

	if botText == nil {
		t.Fatal("no bot text event")
	}
	if botText.Agreed != 2 || botText.Sorry != 1 {
		t.Errorf("bot counts wrong: agreed=%d sorry=%d", botText.Agreed, botText.Sorry)
	}

	// Synthetic model must never contribute a usage event.
	for _, e := range events {
		if e.Model == "claude-3-5-synthetic" {
			t.Error("synthetic model leaked into events")
		}
	}
}

func TestParseCodex(t *testing.T) {
	dir := t.TempDir()
	path := writeFixture(t, dir, "rollout-2024.jsonl", codexJSONL)

	events := parseCodex(path)

	// Two non-zero token_count lines → two usage events; the zero line is
	// skipped but still consumes an ordinal.
	if len(events) != 2 {
		t.Fatalf("got %d codex events, want 2", len(events))
	}

	first := events[0]
	// input = max(0, input_tokens - cached) = 100 - 30 = 70; cacheRead = 30.
	if first.Input != 70 || first.CacheRead != 30 || first.Output != 40 || first.CacheCreate != 0 {
		t.Errorf("codex token math wrong: %+v", first)
	}
	// Model is sniffed from the first "model" string in the file.
	if first.Model != "gpt-5-codex" {
		t.Errorf("model = %q, want gpt-5-codex", first.Model)
	}
	// Session is the bare filename, never a path.
	if first.Session != "rollout-2024.jsonl" {
		t.Errorf("session = %q", first.Session)
	}
	// Ordinal-based dedup id: line 1 is ordinal 1.
	if first.ID != "codex:rollout-2024.jsonl:1" {
		t.Errorf("first id = %q, want codex:rollout-2024.jsonl:1", first.ID)
	}
	// The zero line consumed ordinal 2, so the next real one is ordinal 3.
	if events[1].ID != "codex:rollout-2024.jsonl:3" {
		t.Errorf("second id = %q, want codex:rollout-2024.jsonl:3", events[1].ID)
	}
}

// TestDedupStability proves the same input yields the same ids across runs —
// the property the server relies on to never double-count.
func TestDedupStability(t *testing.T) {
	dir := t.TempDir()
	path := writeFixture(t, dir, "session.jsonl", claudeJSONL)

	a := parseClaude(path, false)
	b := parseClaude(path, false)
	if len(a) != len(b) {
		t.Fatalf("non-deterministic event count: %d vs %d", len(a), len(b))
	}
	for i := range a {
		if a[i].ID != b[i].ID {
			t.Errorf("id drift at %d: %q vs %q", i, a[i].ID, b[i].ID)
		}
	}
}

func TestSwiftDoubleFormat(t *testing.T) {
	cases := map[float64]string{
		1700000000:     "1700000000.0",
		1704207845:     "1704207845.0",
		1700000000.123: "1700000000.123",
		0:              "0.0",
	}
	for in, want := range cases {
		if got := formatSwiftDouble(in); got != want {
			t.Errorf("formatSwiftDouble(%v) = %q, want %q", in, got, want)
		}
	}
}
