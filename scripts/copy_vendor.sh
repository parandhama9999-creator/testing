#!/usr/bin/env bash
# Copies the PDF reader library from node_modules into www/vendor so the app
# works fully offline (no CDN).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=node_modules/pdfjs-dist
DST=www/vendor
rm -rf "$DST"
mkdir -p "$DST"
cp "$SRC/legacy/build/pdf.min.js" "$DST/pdf.min.js"
cp "$SRC/legacy/build/pdf.worker.min.js" "$DST/pdf.worker.min.js"
cp -r "$SRC/cmaps" "$DST/cmaps"
echo "Vendor files copied to $DST"

# Text reading for camera photos (Tesseract). English is bundled; other
# languages are downloaded the first time they are used.
TESS=www/vendor/tess
mkdir -p "$TESS/core" "$TESS/lang"
cp node_modules/tesseract.js/dist/tesseract.min.js node_modules/tesseract.js/dist/worker.min.js "$TESS/"
cp node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js \
   node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js \
   node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js "$TESS/core/"
cp node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz "$TESS/lang/"
echo "Text reader copied to $TESS"
