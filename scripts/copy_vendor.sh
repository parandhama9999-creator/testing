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
