// Package parser reads Claude Code and Codex JSONL logs into a stream of
// sanitized IngestEvents. It is a faithful Go port of the Swift LogParser:
// same dedup-id rules, same token math, same text-analysis hooks. Nothing but
// numbers and opaque ids ever leaves this package — never raw text, never paths.
package parser

import (
	"bufio"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jclement/tokenwatch/agent/internal/textanalysis"
)

// Engine identifies which AI overlord drained the wallet.
type Engine string

const (
	EngineClaude Engine = "Claude"
	EngineCodex  Engine = "Codex"
)

// IngestEvent is one sanitized, billable (or confessional) record. It mirrors
// the TypeScript IngestEvent wire contract field-for-field (camelCase via the
// json tags). A usage record carries token counts with zeroed confessional
// fields; a text record carries confessional counts with zeroed tokens — the
// server keys each by its own `id`, exactly like the Swift app's two tables.
type IngestEvent struct {
	ID      string `json:"id"`
	TS      int64  `json:"ts"`  // epoch seconds
	Day     int64  `json:"day"` // start-of-day epoch seconds, agent-local
	Hour    int    `json:"hour"`
	Session string `json:"session"`
	Engine  Engine `json:"engine"`
	Model   string `json:"model"`

	Input       int `json:"input"`
	CacheRead   int `json:"cacheRead"`
	CacheCreate int `json:"cacheCreate"`
	Output      int `json:"output"`

	Swears int `json:"swears"`
	Polite int `json:"polite"`
	Agreed int `json:"agreed"`
	Sorry  int `json:"sorry"`

	// SwearWords is only populated when the agent runs with --share-swear-words;
	// omitempty keeps it off the wire otherwise.
	SwearWords map[string]int `json:"swearWords,omitempty"`
}

// total is the sum of all four token flavors — used to skip empty usage records.
func (e IngestEvent) total() int { return e.Input + e.CacheRead + e.CacheCreate + e.Output }

// HomeDir lets tests point the parser at a fixture tree.
type Parser struct {
	HomeDir string
}

// New returns a Parser rooted at the current user's home directory.
func New() *Parser {
	home, _ := os.UserHomeDir()
	return &Parser{HomeDir: home}
}

func (p *Parser) ClaudeDir() string { return filepath.Join(p.HomeDir, ".claude", "projects") }
func (p *Parser) CodexDir() string  { return filepath.Join(p.HomeDir, ".codex", "sessions") }

// Enumerate returns every *.jsonl file under both log directories, tagged with
// its engine. Missing directories are silently skipped (a fresh machine may
// only use one tool).
func (p *Parser) Enumerate() []FileRef {
	var out []FileRef
	out = append(out, enumerate(p.ClaudeDir(), EngineClaude)...)
	out = append(out, enumerate(p.CodexDir(), EngineCodex)...)
	return out
}

// FileRef is a log file plus which parser to feed it to.
type FileRef struct {
	Path   string
	Engine Engine
}

func enumerate(dir string, engine Engine) []FileRef {
	var out []FileRef
	_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // unreadable subtree — skip it, don't abort the walk
		}
		if d.IsDir() {
			if strings.HasPrefix(d.Name(), ".") && path != dir {
				return fs.SkipDir // honor skipsHiddenFiles
			}
			return nil
		}
		if filepath.Ext(path) == ".jsonl" {
			out = append(out, FileRef{Path: path, Engine: engine})
		}
		return nil
	})
	return out
}

// ParseFile dispatches to the right per-engine parser.
func (p *Parser) ParseFile(ref FileRef, shareSwearWords bool) []IngestEvent {
	switch ref.Engine {
	case EngineClaude:
		return parseClaude(ref.Path, shareSwearWords)
	case EngineCodex:
		return parseCodex(ref.Path)
	default:
		return nil
	}
}

// ---- date handling ----------------------------------------------------------

// parseDate accepts RFC3339 with or without fractional seconds — the two
// formats the Swift ISO8601 formatters allowed.
func parseDate(s string) (time.Time, bool) {
	if s == "" {
		return time.Time{}, false
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t, true
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, true
	}
	return time.Time{}, false
}

// startOfDay returns local midnight for the given instant — matches
// Calendar.current.startOfDay(for:).
func startOfDay(t time.Time) time.Time {
	loc := t.Local()
	return time.Date(loc.Year(), loc.Month(), loc.Day(), 0, 0, 0, 0, loc.Location())
}

// swiftTimeInterval renders the epoch-seconds value the way Swift's
// `Date.timeIntervalSince1970` (a Double) stringifies, because that exact
// string is hashed into the stable dedup id. Swift prints whole values without
// a decimal point ("1700000000.0" is NOT what it emits — it emits the shortest
// round-tripping form, which for a whole number is "1700000000.0").
//
// Empirically Swift's String(describing: Double) yields "1700000000.0" for an
// integral value and the shortest exact decimal otherwise. Go's
// strconv.FormatFloat(v, 'g', -1, 64) gives "1.7e+09"-style output, which does
// NOT match — so we format deliberately. Timestamps in these logs carry
// millisecond precision at most, so we reconstruct seconds.fraction.
func swiftTimeInterval(t time.Time) string {
	return formatSwiftDouble(float64(t.UnixNano()) / 1e9)
}

// ---- Claude Code ------------------------------------------------------------

// claudeLine is the slice of a Claude JSONL record we care about.
type claudeLine struct {
	Type      string          `json:"type"`
	Timestamp string          `json:"timestamp"`
	RequestID string          `json:"requestId"`
	SessionID string          `json:"sessionId"`
	Message   json.RawMessage `json:"message"`
}

type claudeMessage struct {
	ID      string          `json:"id"`
	Model   string          `json:"model"`
	Content json.RawMessage `json:"content"`
	Usage   *claudeUsage    `json:"usage"`
}

type claudeUsage struct {
	Input       int `json:"input_tokens"`
	CacheRead   int `json:"cache_read_input_tokens"`
	CacheCreate int `json:"cache_creation_input_tokens"`
	Output      int `json:"output_tokens"`
}

func parseClaude(path string, shareSwearWords bool) []IngestEvent {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	file := filepath.Base(path)
	var out []IngestEvent
	usageOrdinal := 0 // mirrors Swift's out.usage.count fallback id

	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 1024*1024), 64*1024*1024) // log lines can be large
	for sc.Scan() {
		line := sc.Text()
		// Cheap string sniff before paying for a JSON parse — same shortcut the
		// Swift used. A line is assistant XOR user.
		isAssistant := strings.Contains(line, `"type":"assistant"`)
		isUser := !isAssistant && strings.Contains(line, `"type":"user"`)
		if !isAssistant && !isUser {
			continue
		}

		var cl claudeLine
		if json.Unmarshal([]byte(line), &cl) != nil {
			continue
		}
		ts, ok := parseDate(cl.Timestamp)
		if !ok {
			continue
		}
		day := startOfDay(ts)

		var msg claudeMessage
		if len(cl.Message) > 0 {
			_ = json.Unmarshal(cl.Message, &msg)
		}

		if isAssistant {
			// --- token usage (the ledger) ---
			if msg.Usage != nil {
				model := msg.Model
				if model == "" {
					model = "unknown-claude"
				}
				if !strings.Contains(model, "synthetic") {
					ev := IngestEvent{
						Input:       msg.Usage.Input,
						CacheRead:   msg.Usage.CacheRead,
						CacheCreate: msg.Usage.CacheCreate,
						Output:      msg.Usage.Output,
					}
					if ev.total() > 0 {
						id := msg.ID
						if id == "" {
							id = cl.RequestID
						}
						if id == "" {
							id = "claude:" + file + ":" + itoa(usageOrdinal)
						}
						session := cl.SessionID
						if session == "" {
							session = file
						}
						ev.ID = id
						ev.TS = ts.Unix()
						ev.Day = day.Unix()
						ev.Hour = ts.Local().Hour()
						ev.Session = session
						ev.Engine = EngineClaude
						ev.Model = model
						out = append(out, ev)
						usageOrdinal++
					}
				}
			}
			// --- the model's bedside manner ---
			body := plainText(msg.Content)
			if body != "" {
				c := textanalysis.Bot(body)
				id := textanalysis.StableID(swiftTimeInterval(ts) + "|a|" + prefix(body, 300))
				out = append(out, IngestEvent{
					ID:     id,
					TS:     ts.Unix(),
					Day:    day.Unix(),
					Hour:   ts.Local().Hour(),
					Engine: EngineClaude,
					Agreed: c.Agreed,
					Sorry:  c.Sorry,
				})
			}
		} else {
			// --- what you said, and how politely ---
			body := plainText(msg.Content)
			if body != "" {
				c := textanalysis.User(body)
				id := textanalysis.StableID(swiftTimeInterval(ts) + "|u|" + prefix(body, 300))
				ev := IngestEvent{
					ID:     id,
					TS:     ts.Unix(),
					Day:    day.Unix(),
					Hour:   ts.Local().Hour(),
					Engine: EngineClaude,
					Swears: c.Swears,
					Polite: c.Polite,
				}
				if shareSwearWords && len(c.SwearWords) > 0 {
					ev.SwearWords = c.SwearWords
				}
				out = append(out, ev)
			}
		}
	}
	return out
}

// ---- Codex ------------------------------------------------------------------

type codexLine struct {
	Timestamp string          `json:"timestamp"`
	Payload   json.RawMessage `json:"payload"`
}

type codexPayload struct {
	Type string     `json:"type"`
	Info *codexInfo `json:"info"`
}

type codexInfo struct {
	LastTokenUsage *codexTokenUsage `json:"last_token_usage"`
}

type codexTokenUsage struct {
	Input  int `json:"input_tokens"`
	Cached int `json:"cached_input_tokens"`
	Output int `json:"output_tokens"`
}

func parseCodex(path string) []IngestEvent {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	file := filepath.Base(path) // session is the bare filename — never the path
	model := "gpt-5"
	foundModel := false
	var out []IngestEvent
	ordinal := 0

	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 1024*1024), 64*1024*1024)
	for sc.Scan() {
		line := sc.Text()

		// First `"model":"..."` wins, same as the Swift one-pass scan.
		if !foundModel {
			if i := strings.Index(line, `"model":"`); i >= 0 {
				rest := line[i+len(`"model":"`):]
				if end := strings.IndexByte(rest, '"'); end >= 0 {
					model = rest[:end]
					foundModel = true
				}
			}
		}

		if !strings.Contains(line, `"token_count"`) || !strings.Contains(line, "last_token_usage") {
			continue
		}
		var cl codexLine
		if json.Unmarshal([]byte(line), &cl) != nil {
			continue
		}
		var pl codexPayload
		if len(cl.Payload) == 0 || json.Unmarshal(cl.Payload, &pl) != nil {
			continue
		}
		if pl.Type != "token_count" || pl.Info == nil || pl.Info.LastTokenUsage == nil {
			continue
		}
		ts, ok := parseDate(cl.Timestamp)
		if !ok {
			continue
		}

		u := pl.Info.LastTokenUsage
		input := u.Input - u.Cached
		if input < 0 {
			input = 0
		}
		ev := IngestEvent{
			Input:     input,
			CacheRead: u.Cached,
			Output:    u.Output,
		}
		ordinal++ // ordinal increments even for zero-total lines, matching Swift
		if ev.total() == 0 {
			continue
		}
		ev.ID = "codex:" + file + ":" + itoa(ordinal)
		ev.TS = ts.Unix()
		ev.Day = startOfDay(ts).Unix()
		ev.Hour = ts.Local().Hour()
		ev.Session = file
		ev.Engine = EngineCodex
		ev.Model = model
		out = append(out, ev)
	}
	return out
}

// ---- content extraction -----------------------------------------------------

// plainText pulls human/assistant text out of a `content` field, which is
// either a bare string or an array of typed blocks. Only "text" blocks count;
// tool results and thinking are skipped — identical to the Swift plainText.
func plainText(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var s string
	if json.Unmarshal(raw, &s) == nil {
		return s
	}
	var blocks []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if json.Unmarshal(raw, &blocks) == nil {
		var parts []string
		for _, b := range blocks {
			if b.Type == "text" {
				parts = append(parts, b.Text)
			}
		}
		return strings.Join(parts, " ")
	}
	return ""
}

// prefix returns the first n runes of s — Swift's `body.prefix(300)` counts
// Characters (grapheme-ish), but for our ASCII-heavy logs rune-truncation is
// the faithful, practical equivalent. The hash only needs to be stable and
// consistent with itself across runs, which this guarantees.
func prefix(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

func itoa(n int) string {
	// tiny local helper so callers read cleanly; strconv would also do.
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
