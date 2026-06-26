#!/usr/bin/env bash
# TokenWatch agent installer.
#   curl -fsSL https://tokens.onewheelgeek.net/install.sh | sh
#   curl -fsSL https://tokens.onewheelgeek.net/install.sh | sh -s -- --pair ABCD-1234
#
# Downloads the right binary for your OS/arch from the latest GitHub release,
# installs it to ~/.local/bin (or /usr/local/bin if writable), and — if a
# pairing code is given — pairs the device and runs an initial sync.
set -euo pipefail

REPO="jclement/tokenwatch"
PAIR_CODE=""
SERVER="https://tokens.onewheelgeek.net"

while [ $# -gt 0 ]; do
  case "$1" in
    --pair) PAIR_CODE="$2"; shift 2 ;;
    --url) SERVER="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH="amd64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *) echo "unsupported arch: $ARCH" >&2; exit 1 ;;
esac
case "$OS" in
  darwin|linux) ;;
  *) echo "unsupported OS: $OS (use the Windows installer instead)" >&2; exit 1 ;;
esac

ASSET="tokenwatch_${OS}_${ARCH}.tar.gz"
URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"

# Pick an install dir.
if [ -w "/usr/local/bin" ]; then
  DEST="/usr/local/bin/tokenwatch"
else
  DEST="$HOME/.local/bin/tokenwatch"
  mkdir -p "$HOME/.local/bin"
fi

echo "Downloading TokenWatch agent ($ASSET)…"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$URL" -o "$TMP/agent.tar.gz"
tar -xzf "$TMP/agent.tar.gz" -C "$TMP" tokenwatch
install -m 0755 "$TMP/tokenwatch" "$DEST" 2>/dev/null || { cp "$TMP/tokenwatch" "$DEST"; chmod +x "$DEST"; }
echo "✓ installed to $DEST"

case ":$PATH:" in
  *":$(dirname "$DEST"):"*) ;;
  *) echo "⚠️  $(dirname "$DEST") is not on your PATH — add it to use 'tokenwatch' directly." ;;
esac

if [ -n "$PAIR_CODE" ]; then
  echo "Pairing this device…"
  "$DEST" --url "$SERVER" --pair "$PAIR_CODE"
  echo "Running an initial sync…"
  "$DEST" --url "$SERVER" --once
  echo
  echo "To keep it syncing automatically, run:  tokenwatch --install"
else
  echo "Now pair this device with a code from $SERVER → Settings:"
  echo "  tokenwatch --pair <CODE>"
fi
