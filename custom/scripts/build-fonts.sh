#!/usr/bin/env bash
# ATV fork: build the web fonts that replace the Star4000 faces.
#   source: custom/fonts/src/ChivoMono[wght].ttf (variable font, SIL OFL 1.1)
#   output: server/fonts/atv/ChivoMono-{600,700}.woff2 + OFL.txt
# Requires Python with fonttools and brotli:  pip install fonttools brotli
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

SRC="custom/fonts/src/ChivoMono[wght].ttf"
OUT="server/fonts/atv"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Basic Latin + Latin-1 (°, ½, accented names) + typographic punctuation
UNICODES="U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201D,U+2022,U+2026"

mkdir -p "$OUT"
for WEIGHT in 600 700; do
	# pin the weight axis to a static instance, then subset to WOFF2
	python3 -I -m fontTools.varLib.instancer "$SRC" "wght=$WEIGHT" -o "$TMP/ChivoMono-$WEIGHT.ttf" -q
	python3 -I -m fontTools.subset "$TMP/ChivoMono-$WEIGHT.ttf" \
		--unicodes="$UNICODES" \
		--layout-features='kern,liga,case' \
		--flavor=woff2 \
		--output-file="$OUT/ChivoMono-$WEIGHT.woff2"
	echo "✓ $OUT/ChivoMono-$WEIGHT.woff2 ($(wc -c < "$OUT/ChivoMono-$WEIGHT.woff2") bytes)"
done

# the OFL requires the license to travel with the font files
cp custom/fonts/src/OFL.txt "$OUT/OFL.txt"
