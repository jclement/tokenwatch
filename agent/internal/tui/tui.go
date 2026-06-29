// Package tui is the --tui dashboard: a token histograph by model on top, an
// activity log on the bottom, a status bar, and keybindings (p to push, r to
// rescan, q to quit with a matrix dissolve). Built on Bubble Tea + Lipgloss.
package tui

import (
	"context"
	"fmt"
	"math/rand"
	"regexp"
	"sort"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/jclement/tokenwatch/agent/internal/client"
	"github.com/jclement/tokenwatch/agent/internal/config"
	"github.com/jclement/tokenwatch/agent/internal/parser"
	"github.com/jclement/tokenwatch/agent/internal/ui"
)

// Run launches the TUI and blocks until the user quits. `every` is the
// auto-sync interval (continuous mode, on by default).
func Run(cfg *config.Config, version string, every time.Duration) error {
	p := tea.NewProgram(newModel(cfg, version, every), tea.WithAltScreen())
	_, err := p.Run()
	return err
}

type modelStat struct {
	engine string
	tokens int
}

type logLine struct {
	t     time.Time
	level string // info | ok | warn | err
	msg   string
}

type model struct {
	cfg     *config.Config
	version string
	w, h    int

	agg  map[string]*modelStat
	logs []logLine
	spin int
	now  time.Time

	scanning bool

	// continuous auto-sync
	autoEvery time.Duration
	autoOn    bool
	lastSync  time.Time // last auto-sync attempt (success or not), for scheduling

	lastPushAt time.Time
	lastRecv   int
	lastIns    int
	sessTokens int
	sessEvents int
	files      int

	// dissolve animation
	dissolving bool
	dframe     int
	grid       []string
	noise      [][]float64
	rng        *rand.Rand
}

const dissolveFrames = 16

func newModel(cfg *config.Config, version string, every time.Duration) model {
	if every <= 0 {
		every = 5 * time.Minute
	}
	return model{
		cfg:       cfg,
		version:   version,
		agg:       map[string]*modelStat{},
		now:       time.Now(),
		scanning:  true, // initial scan in flight
		autoEvery: every,
		autoOn:    true,
		rng:       rand.New(rand.NewSource(time.Now().UnixNano())),
		logs: []logLine{
			{time.Now(), "info", "Scanning local Claude Code & Codex logs…"},
		},
	}
}

// ---- messages & commands ----------------------------------------------------

type tickMsg time.Time
type dissolveMsg struct{}
type scanMsg struct {
	agg   map[string]*modelStat
	files int
}
type pushMsg struct {
	recv, ins, events, tokens int
	byModel                   map[string]int
	engines                   map[string]string
	files                     int
	err                       error
}

func tick() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg { return tickMsg(t) })
}

func dissolveTick() tea.Cmd {
	return tea.Tick(55*time.Millisecond, func(time.Time) tea.Msg { return dissolveMsg{} })
}

// initialScan parses everything (ignoring fingerprints) to populate the
// histograph with a full local picture.
func initialScan() tea.Msg {
	p := parser.New()
	agg := map[string]*modelStat{}
	files := p.Enumerate()
	for _, ref := range files {
		for _, e := range p.ParseFile(ref, false) {
			tok := e.Input + e.CacheRead + e.CacheCreate + e.Output
			if e.Model == "" || tok == 0 {
				continue
			}
			s := agg[e.Model]
			if s == nil {
				s = &modelStat{engine: string(e.Engine)}
				agg[e.Model] = s
			}
			s.tokens += tok
		}
	}
	return scanMsg{agg: agg, files: len(files)}
}

// doPush scans changed files and uploads them (the real sync).
func doPush(cfg *config.Config, version string) tea.Cmd {
	return func() tea.Msg {
		if cfg.DeviceToken == "" {
			return pushMsg{err: fmt.Errorf("not paired — run: tokenwatch --pair <CODE>")}
		}
		p := parser.New()
		files := p.Enumerate()
		var events []parser.IngestEvent
		pending := map[string]config.Fingerprint{}
		for _, ref := range files {
			fp, err := config.FingerprintOf(ref.Path)
			if err != nil {
				continue
			}
			if cfg.Unchanged(ref.Path, fp) {
				continue
			}
			events = append(events, p.ParseFile(ref, false)...)
			pending[ref.Path] = fp
		}
		byModel := map[string]int{}
		engines := map[string]string{}
		tokens := 0
		for _, e := range events {
			tok := e.Input + e.CacheRead + e.CacheCreate + e.Output
			if e.Model == "" || tok == 0 {
				continue
			}
			byModel[e.Model] += tok
			engines[e.Model] = string(e.Engine)
			tokens += tok
		}
		if len(events) == 0 {
			return pushMsg{files: len(files)}
		}
		c := client.New(cfg.ServerURL, cfg.DeviceToken, version)
		resp, err := c.Ingest(context.Background(), events)
		if err != nil {
			return pushMsg{err: err}
		}
		for path, fp := range pending {
			cfg.Remember(path, fp)
		}
		_ = cfg.Save()
		return pushMsg{
			recv: resp.Received, ins: resp.Inserted, events: len(events),
			tokens: tokens, byModel: byModel, engines: engines, files: len(files),
		}
	}
}

func (m model) Init() tea.Cmd {
	return tea.Batch(tick(), func() tea.Msg { return initialScan() })
}

// ---- update -----------------------------------------------------------------

func (m *model) log(level, msg string) {
	m.logs = append(m.logs, logLine{time.Now(), level, msg})
	if len(m.logs) > 200 {
		m.logs = m.logs[len(m.logs)-200:]
	}
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.w, m.h = msg.Width, msg.Height
		return m, nil

	case tea.KeyMsg:
		if m.dissolving {
			return m, nil
		}
		switch msg.String() {
		case "q", "ctrl+c", "esc":
			return m.startDissolve()
		case "p":
			if !m.scanning {
				m.scanning = true
				m.lastSync = time.Now() // reset the auto-sync clock
				m.log("info", "Pushing new events…")
				return m, doPush(m.cfg, m.version)
			}
		case "r":
			if !m.scanning {
				m.scanning = true
				m.log("info", "Rescanning local logs…")
				return m, func() tea.Msg { return initialScan() }
			}
		case "a":
			m.autoOn = !m.autoOn
			if m.autoOn {
				m.log("info", fmt.Sprintf("Auto-sync on (every %s).", shortDur(m.autoEvery)))
			} else {
				m.log("info", "Auto-sync paused.")
			}
		}
		return m, nil

	case tickMsg:
		m.now = time.Time(msg)
		m.spin++
		// Continuous mode: fire an auto-sync when due.
		if m.autoOn && !m.scanning && m.cfg.DeviceToken != "" && m.dueForSync() {
			m.scanning = true
			m.lastSync = m.now
			m.log("info", "Auto-sync…")
			return m, tea.Batch(tick(), doPush(m.cfg, m.version))
		}
		return m, tick()

	case scanMsg:
		m.agg = msg.agg
		m.files = msg.files
		m.scanning = false
		m.log("ok", fmt.Sprintf("Scanned %d log files · %d models, %s tokens local",
			msg.files, len(msg.agg), fmtTokens(sumTokens(msg.agg))))
		return m, nil

	case pushMsg:
		m.scanning = false
		if msg.err != nil {
			m.log("err", "Push failed: "+msg.err.Error())
			return m, nil
		}
		m.files = msg.files
		if msg.events == 0 {
			m.log("info", fmt.Sprintf("Nothing new (%d files, all unchanged).", msg.files))
			return m, nil
		}
		m.lastPushAt = time.Now()
		m.lastRecv = msg.recv
		m.lastIns = msg.ins
		m.sessEvents += msg.events
		m.sessTokens += msg.tokens
		for mdl, tok := range msg.byModel {
			s := m.agg[mdl]
			if s == nil {
				s = &modelStat{engine: msg.engines[mdl]}
				m.agg[mdl] = s
			}
			s.tokens += tok
		}
		m.log("ok", fmt.Sprintf("Pushed %d events · received %d, inserted %d · %s tokens",
			msg.events, msg.recv, msg.ins, fmtTokens(msg.tokens)))
		return m, nil

	case dissolveMsg:
		m.dframe++
		if m.dframe > dissolveFrames {
			return m, tea.Quit
		}
		return m, dissolveTick()
	}
	return m, nil
}

// dueForSync reports whether an auto-sync should fire now.
func (m model) dueForSync() bool {
	if m.lastSync.IsZero() {
		return true // sync immediately on launch, like --continuous
	}
	return m.now.Sub(m.lastSync) >= m.autoEvery
}

// shortDur renders a duration compactly: "5m", "90s", "2m30s".
func shortDur(d time.Duration) string {
	d = d.Round(time.Second)
	if d >= time.Minute && d%time.Minute == 0 {
		return fmt.Sprintf("%dm", int(d/time.Minute))
	}
	return d.String()
}

func (m model) startDissolve() (tea.Model, tea.Cmd) {
	frame := stripANSI(m.renderMain())
	lines := strings.Split(frame, "\n")
	width := 0
	for _, l := range lines {
		if n := len([]rune(l)); n > width {
			width = n
		}
	}
	// pad + precompute a per-cell death threshold (biased to fall top-first)
	m.grid = make([]string, len(lines))
	m.noise = make([][]float64, len(lines))
	for i, l := range lines {
		r := []rune(l)
		for len(r) < width {
			r = append(r, ' ')
		}
		m.grid[i] = string(r)
		m.noise[i] = make([]float64, width)
		for j := range m.noise[i] {
			m.noise[i][j] = m.rng.Float64()
		}
	}
	m.dissolving = true
	m.dframe = 0
	return m, dissolveTick()
}

// ---- view -------------------------------------------------------------------

func (m model) View() string {
	if m.dissolving {
		return m.renderDissolve()
	}
	return m.renderMain()
}

var glyphs = []rune("ｱｲｳｴｵｶｷｸｹｺﾅﾆﾇﾈﾉ0123456789Z:.=*+<>$")

func (m model) renderDissolve() string {
	rows := len(m.grid)
	t := float64(m.dframe) / float64(dissolveFrames)
	bright := lipgloss.NewStyle().Foreground(ui.Lime).Bold(true)
	trail := lipgloss.NewStyle().Foreground(ui.Mint)
	var b strings.Builder
	for r := 0; r < rows; r++ {
		row := []rune(m.grid[r])
		fall := float64(r) / float64(rows) * 0.55 // top rows dissolve first
		for c, ch := range row {
			death := fall + m.noise[r][c]*0.5
			switch {
			case t > death+0.12:
				b.WriteByte(' ')
			case t > death:
				b.WriteString(bright.Render(string(glyphs[m.rng.Intn(len(glyphs))])))
			default:
				if ch == ' ' {
					b.WriteByte(' ')
				} else {
					b.WriteString(trail.Render(string(ch)))
				}
			}
		}
		if r < rows-1 {
			b.WriteByte('\n')
		}
	}
	return b.String()
}

func (m model) renderMain() string {
	w := m.w
	if w < 20 {
		w = 80
	}
	h := m.h
	if h < 10 {
		h = 24
	}

	title := m.renderTitle(w)
	status := m.renderStatus(w)
	help := ui.DimStyle.Render("  q quit · p push now · a auto-sync · r rescan")

	// fixed-height pieces
	used := lipgloss.Height(title) + lipgloss.Height(status) + lipgloss.Height(help)
	bodyH := h - used
	if bodyH < 6 {
		bodyH = 6
	}
	histH := bodyH * 2 / 5
	if histH < 5 {
		histH = 5
	}
	logH := bodyH - histH

	hist := m.renderHist(w, histH)
	logs := m.renderLogs(w, logH)

	return lipgloss.JoinVertical(lipgloss.Left, title, hist, logs, status, help)
}

func (m model) renderTitle(w int) string {
	spinner := []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
	left := "  " + ui.Logo() + ui.DimStyle.Render("  · ingest dashboard")
	right := ""
	if m.scanning {
		right = ui.AccentStyle.Render(spinner[m.spin%len(spinner)]+" working") + "  "
	}
	gap := w - lipgloss.Width(left) - lipgloss.Width(right)
	if gap < 1 {
		gap = 1
	}
	return left + strings.Repeat(" ", gap) + right
}

func (m model) renderHist(w, h int) string {
	box := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).BorderForeground(ui.Faint).
		Width(w-2).Height(h-2).Padding(0, 1)

	inner := w - 6
	var b strings.Builder
	b.WriteString(ui.BoldStyle.Render("Tokens by model") + "\n")

	type row struct {
		name   string
		engine string
		tokens int
	}
	rows := make([]row, 0, len(m.agg))
	for name, s := range m.agg {
		rows = append(rows, row{name, s.engine, s.tokens})
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].tokens > rows[j].tokens })

	if len(rows) == 0 {
		b.WriteString(ui.DimStyle.Render("  no token usage found in local logs yet"))
		return box.Render(b.String())
	}

	max := rows[0].tokens
	limit := h - 3
	if limit < 1 {
		limit = 1
	}
	labelW := 18
	valW := 9
	barW := inner - labelW - valW - 2
	if barW < 4 {
		barW = 4
	}
	for i, r := range rows {
		if i >= limit {
			b.WriteString(ui.DimStyle.Render(fmt.Sprintf("  …and %d more", len(rows)-limit)))
			break
		}
		name := r.name
		if len([]rune(name)) > labelW {
			name = string([]rune(name)[:labelW-1]) + "…"
		}
		name = fmt.Sprintf("%-*s", labelW, name)
		filled := int(float64(barW) * float64(r.tokens) / float64(max))
		if filled < 1 {
			filled = 1
		}
		bar := strings.Repeat("█", filled) + strings.Repeat("·", barW-filled)
		barStyled := lipgloss.NewStyle().Foreground(ui.EngineColor(r.engine)).Render(bar)
		val := fmt.Sprintf("%*s", valW, fmtTokens(r.tokens))
		b.WriteString(ui.DimStyle.Render(name) + " " + barStyled + " " + ui.BoldStyle.Render(val))
		if i < limit-1 && i < len(rows)-1 {
			b.WriteByte('\n')
		}
	}
	return box.Render(b.String())
}

func (m model) renderLogs(w, h int) string {
	box := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).BorderForeground(ui.Faint).
		Width(w-2).Height(h-2).Padding(0, 1)

	avail := h - 2 // border
	if avail < 1 {
		avail = 1
	}
	start := 0
	if len(m.logs) > avail {
		start = len(m.logs) - avail
	}
	var b strings.Builder
	for i := start; i < len(m.logs); i++ {
		ln := m.logs[i]
		ts := ui.DimStyle.Render(ln.t.Format("15:04:05"))
		var marker string
		switch ln.level {
		case "ok":
			marker = ui.SuccessStyle.Render("✓")
		case "warn":
			marker = ui.WarnStyle.Render("▲")
		case "err":
			marker = ui.ErrorStyle.Render("✗")
		default:
			marker = ui.DimStyle.Render("·")
		}
		b.WriteString(ts + " " + marker + " " + ln.msg)
		if i < len(m.logs)-1 {
			b.WriteByte('\n')
		}
	}
	return box.Render(b.String())
}

func (m model) renderStatus(w int) string {
	host := hostShort(m.cfg.ServerURL)
	paired := ui.ErrorStyle.Render("● unpaired")
	if m.cfg.DeviceToken != "" {
		paired = ui.SuccessStyle.Render("● paired")
	}
	last := ui.DimStyle.Render("no push")
	if !m.lastPushAt.IsZero() {
		last = fmt.Sprintf("push %s +%d", m.lastPushAt.Format("15:04"), m.lastIns)
	}
	sess := fmt.Sprintf("↑%d ev · %s tok", m.sessEvents, fmtTokens(m.sessTokens))

	auto := ui.DimStyle.Render("auto off")
	if m.autoOn {
		label := "⟳ auto " + shortDur(m.autoEvery)
		if m.cfg.DeviceToken != "" {
			rem := m.autoEvery
			if !m.lastSync.IsZero() {
				rem = m.autoEvery - m.now.Sub(m.lastSync)
			}
			if rem < 0 {
				rem = 0
			}
			label += fmt.Sprintf(" (next %d:%02d)", int(rem/time.Minute), int(rem%time.Minute/time.Second))
		}
		auto = ui.SuccessStyle.Render(label)
	}

	segs := []string{
		ui.AccentStyle.Render(host),
		paired,
		auto,
		last,
		ui.BoldStyle.Render(sess),
		ui.DimStyle.Render("v" + m.version),
		ui.DimStyle.Render(m.now.Format("15:04:05")),
	}
	line := " " + strings.Join(segs, ui.DimStyle.Render(" · ")) + " "
	// Inline + MaxWidth guarantees a single, clipped line — never wraps.
	bar := lipgloss.NewStyle().Background(ui.BgAlt).Width(w).MaxWidth(w).Inline(true)
	return bar.Render(line)
}

// ---- helpers ----------------------------------------------------------------

func sumTokens(agg map[string]*modelStat) int {
	n := 0
	for _, s := range agg {
		n += s.tokens
	}
	return n
}

func fmtTokens(n int) string {
	f := float64(n)
	switch {
	case f >= 1e9:
		return fmt.Sprintf("%.2fB", f/1e9)
	case f >= 1e6:
		return fmt.Sprintf("%.2fM", f/1e6)
	case f >= 1e3:
		return fmt.Sprintf("%.1fK", f/1e3)
	default:
		return fmt.Sprintf("%d", n)
	}
}

func hostShort(url string) string {
	s := strings.TrimPrefix(strings.TrimPrefix(url, "https://"), "http://")
	return strings.TrimSuffix(s, "/")
}

var ansiRe = regexp.MustCompile(`\x1b\[[0-9;]*m`)

func stripANSI(s string) string { return ansiRe.ReplaceAllString(s, "") }
