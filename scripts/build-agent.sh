#!/usr/bin/env bash
# Cross-compile the TokenWatch agent for every supported platform.
# Usage: scripts/build-agent.sh [version]   (version defaults to "dev")
set -euo pipefail

VERSION="${1:-dev}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_DIR="$ROOT/agent"
OUT="$AGENT_DIR/dist"
rm -rf "$OUT"
mkdir -p "$OUT"

PLATFORMS=(
  "darwin/amd64"
  "darwin/arm64"
  "linux/amd64"
  "linux/arm64"
  "windows/amd64"
  "windows/arm64"
)

cd "$AGENT_DIR"
for p in "${PLATFORMS[@]}"; do
  GOOS="${p%/*}"
  GOARCH="${p#*/}"
  name="tokenwatch_${GOOS}_${GOARCH}"
  ext=""
  [ "$GOOS" = "windows" ] && ext=".exe"
  echo "→ building $name$ext"
  CGO_ENABLED=0 GOOS="$GOOS" GOARCH="$GOARCH" \
    go build -trimpath -ldflags "-s -w -X main.Version=$VERSION" \
    -o "$OUT/$name$ext" .
done

# Checksums for the installer / verification.
cd "$OUT"
if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 tokenwatch_* > checksums.txt
else
  sha256sum tokenwatch_* > checksums.txt
fi
echo "✓ binaries + checksums in $OUT"
