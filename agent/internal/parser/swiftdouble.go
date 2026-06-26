package parser

import (
	"math"
	"strconv"
	"strings"
)

// formatSwiftDouble reproduces how Swift stringifies a Double via interpolation
// (`"\(d)"`), because that string is fed verbatim into the FNV stable id. Get
// this wrong and the Go agent's user-turn ids won't match the Swift app's, so
// the same turns would be counted twice server-side.
//
// Swift's rule (its Double.description) is "shortest decimal that round-trips,
// always with a decimal point". Examples:
//
//	1700000000      -> "1700000000.0"
//	1700000000.123  -> "1700000000.123"
//	0               -> "0.0"
//
// Go's strconv with 'f'/-1 gives the shortest decimal but drops the trailing
// ".0" for integral values, and 'g'/-1 may switch to exponent form. We start
// from the shortest round-tripping decimal ('f', -1) and re-attach ".0" when
// it came out whole. Swift never uses exponent form for the seconds-since-epoch
// magnitudes we deal with here, so 'f' is the right base format.
func formatSwiftDouble(d float64) string {
	if math.IsInf(d, 0) || math.IsNaN(d) {
		// Not reachable for real timestamps, but keep it deterministic.
		return strconv.FormatFloat(d, 'f', -1, 64)
	}
	s := strconv.FormatFloat(d, 'f', -1, 64)
	if !strings.ContainsRune(s, '.') {
		s += ".0"
	}
	return s
}
