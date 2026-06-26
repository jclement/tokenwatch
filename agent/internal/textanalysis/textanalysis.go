// Package textanalysis mines transcript text for the things you'd rather not
// admit: profanity, politeness, and the model's relentless agreeableness. All
// counts only — no raw text ever leaves this machine.
//
// This is a faithful port of the Swift TextAnalysis.swift: same lexicon, same
// FNV-1a constants, same token-splitting rules.
package textanalysis

import (
	"strconv"
	"strings"
	"unicode"
)

// FNV-1a 64-bit constants. These MUST match the Swift reference exactly, or the
// dedup ids the two implementations produce will diverge and the server will
// double-count the same user turns.
const (
	fnvOffsetBasis uint64 = 0xcbf29ce484222325
	fnvPrime       uint64 = 0x100000001b3
)

// StableID is a deterministic 64-bit FNV-1a hash rendered as lowercase hex.
// Go's built-in maps are seeded per-process and useless for persistence, hence
// the hand-rolled hash — same reasoning as the Swift original.
func StableID(s string) string {
	h := fnvOffsetBasis
	for _, b := range []byte(s) { // hash over UTF-8 bytes, matching Swift's s.utf8
		h ^= uint64(b)
		h *= fnvPrime
	}
	return strconv.FormatUint(h, 16)
}

// profanity is the exact-token profanity set (inflections included). Matching on
// whole tokens — never substrings — avoids the Scunthorpe problem ("class",
// "assist", "hello" must stay innocent).
var profanity = map[string]struct{}{}

// politeWords are the tokens we count toward politeness.
var politeWords = map[string]struct{}{}

func init() {
	for _, w := range []string{
		"fuck", "fucks", "fucked", "fucking", "fucker", "fuckers", "fuckin", "motherfucker",
		"shit", "shits", "shitty", "shitting", "bullshit", "horseshit", "dogshit",
		"damn", "damned", "goddamn", "goddamnit", "dammit",
		"hell", "crap", "crappy",
		"ass", "asshole", "assholes", "jackass", "dumbass",
		"bitch", "bitches", "bitching",
		"bastard", "bastards",
		"piss", "pissed", "pissing",
		"dick", "dickhead", "prick",
		"wtf", "ffs", "stfu", "goddammit",
		"screwed", "frickin", "friggin",
	} {
		profanity[w] = struct{}{}
	}
	for _, w := range []string{"please", "pls", "plz", "thanks", "thank", "thx", "appreciate"} {
		politeWords[w] = struct{}{}
	}
}

// tokenize lower-cases and splits on any non-letter rune — the same rule as the
// Swift `text.lowercased().split { !($0.isLetter) }`.
func tokenize(text string) []string {
	return strings.FieldsFunc(strings.ToLower(text), func(r rune) bool {
		return !unicode.IsLetter(r)
	})
}

// count returns the number of non-overlapping, case-insensitive occurrences of
// needle in hay. Mirrors the Swift `count(_:in:)` helper used for bot phrases.
func count(needle, hay string) int {
	if needle == "" {
		return 0
	}
	return strings.Count(strings.ToLower(hay), strings.ToLower(needle))
}

// UserCounts is the result of analyzing a human message.
type UserCounts struct {
	Swears     int
	Polite     int
	SwearWords map[string]int
}

// BotCounts is the result of analyzing an assistant message.
type BotCounts struct {
	Agreed int
	Sorry  int
}

// User analyzes a human message: profanity + manners.
func User(text string) UserCounts {
	c := UserCounts{SwearWords: map[string]int{}}
	for _, tok := range tokenize(text) {
		if _, ok := profanity[tok]; ok {
			c.Swears++
			c.SwearWords[tok]++
		} else if _, ok := politeWords[tok]; ok {
			c.Polite++
		}
	}
	return c
}

// Bot analyzes an assistant message: sycophancy + apologies.
func Bot(text string) BotCounts {
	var c BotCounts
	c.Agreed += count("absolutely right", text)
	c.Agreed += count("you're right", text)
	c.Agreed += count("you are right", text)
	c.Agreed += count("good catch", text)
	c.Sorry += count("i apologize", text)
	c.Sorry += count("my apologies", text)
	c.Sorry += count("i'm sorry", text)
	return c
}
