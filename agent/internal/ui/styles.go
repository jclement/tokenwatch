// Package ui holds the shared visual language for the agent's terminal output:
// the TokenWatch palette (ported from the web app's theme) plus lipgloss styles
// used by both the colored CLI helpers and the --tui dashboard. lipgloss
// auto-detects color support and honors NO_COLOR / non-TTY, so these degrade to
// plain text when piped.
package ui

import "github.com/charmbracelet/lipgloss"

// Palette — same hexes as the web app's Theme.
var (
	Mint  = lipgloss.Color("#66f2bd")
	Cyan  = lipgloss.Color("#5cc7fa")
	Amber = lipgloss.Color("#ffbd57")
	Coral = lipgloss.Color("#ff737a")
	Lime  = lipgloss.Color("#b8f25c")
	Ink   = lipgloss.Color("#e8eaf0")
	Faint = lipgloss.Color("#7a8090")
	BgAlt = lipgloss.Color("#141721")
)

// EngineColor maps an engine name to its accent (matches the web UI).
func EngineColor(engine string) lipgloss.Color {
	if engine == "Codex" {
		return Cyan
	}
	return Amber
}

// Inline text styles.
var (
	SuccessStyle = lipgloss.NewStyle().Foreground(Mint).Bold(true)
	ErrorStyle   = lipgloss.NewStyle().Foreground(Coral).Bold(true)
	WarnStyle    = lipgloss.NewStyle().Foreground(Amber)
	AccentStyle  = lipgloss.NewStyle().Foreground(Cyan)
	DimStyle     = lipgloss.NewStyle().Foreground(Faint)
	BoldStyle    = lipgloss.NewStyle().Foreground(Ink).Bold(true)
)
