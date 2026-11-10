#!/usr/bin/env bash
# The translation plugin only downloads language packs over Wi-Fi, so on mobile
# data the download waits forever. This removes that restriction.
set -euo pipefail
cd "$(dirname "$0")/.."
F=node_modules/@capacitor-mlkit/translation/android/src/main/java/io/capawesome/capacitorjs/plugins/mlkit/translation/Translation.java
grep -q '\.requireWifi()' "$F" || { echo "requireWifi() not found in $F"; exit 1; }
sed -i 's/\.requireWifi()//g' "$F"
! grep -q 'requireWifi' "$F"
echo "Translation plugin patched: language packs download on any connection"
