package ui

import (
	"fmt"
	"os"
)

// Colored, tasteful CLI output helpers. They write through lipgloss styles,
// which render plain when stdout/stderr isn't a terminal or NO_COLOR is set.

// Logo returns the little flame wordmark.
func Logo() string {
	return "🔥 " + SuccessStyle.Render("Token") + AccentStyle.Render("Watch")
}

// Success prints a mint ✓ line.
func Success(format string, a ...any) {
	fmt.Println(SuccessStyle.Render("✓ ") + fmt.Sprintf(format, a...))
}

// Info prints a neutral line with a faint bullet.
func Info(format string, a ...any) {
	fmt.Println(DimStyle.Render("· ") + fmt.Sprintf(format, a...))
}

// Warn prints an amber ▲ line to stderr.
func Warn(format string, a ...any) {
	fmt.Fprintln(os.Stderr, WarnStyle.Render("▲ "+fmt.Sprintf(format, a...)))
}

// Error prints a coral ✗ line to stderr.
func Error(format string, a ...any) {
	fmt.Fprintln(os.Stderr, ErrorStyle.Render("✗ "+fmt.Sprintf(format, a...)))
}

// Accent / Dim / Bold render inline spans for composing richer lines.
func Accent(s string) string { return AccentStyle.Render(s) }
func Dim(s string) string    { return DimStyle.Render(s) }
func Bold(s string) string   { return BoldStyle.Render(s) }
func Mintf(s string) string  { return SuccessStyle.Render(s) }
