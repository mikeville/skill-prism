#!/usr/bin/env bash
# Regenerate src/assets/anybody-latin.ttf from the @fontsource-variable/anybody
# woff2. Run this if you bump the fontsource version. The TTF is committed
# (not derived at build time) so the export bundle doesn't need wawoff2 / wasm
# at runtime — see src/lib/export/textToPath.ts for why.
set -euo pipefail

WAWOFF2_BIN="node_modules/wawoff2/bin/woff2_decompress.js"
SRC="node_modules/@fontsource-variable/anybody/files/anybody-latin-standard-normal.woff2"
DEST="src/assets/anybody-latin.ttf"

if [ ! -f "$WAWOFF2_BIN" ]; then
  echo "Installing wawoff2 temporarily…"
  npm install --no-save wawoff2
fi

mkdir -p "$(dirname "$DEST")"
node "$WAWOFF2_BIN" "$SRC" "$DEST"
echo "Wrote $DEST"
