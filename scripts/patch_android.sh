#!/usr/bin/env bash
# Patches the generated Android project after `npx cap add android`:
#   1. AdMob APPLICATION_ID <meta-data> (without it the app crashes on launch)
#   2. MainActivity android:screenOrientation="fullSensor" (rotation allowed)
#   3. INTERNET + BILLING permissions (idempotent)
# Override the AdMob app ID for release with:  ADMOB_APP_ID=ca-app-pub-XXXX~YYYY bash scripts/patch_android.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/android/app/src/main/AndroidManifest.xml"
ADMOB_APP_ID="${ADMOB_APP_ID:-ca-app-pub-3940256099942544~3347511713}"

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: $MANIFEST not found. Run 'npx cap add android' first." >&2
  exit 1
fi

python3 - "$MANIFEST" "$ADMOB_APP_ID" <<'PY'
import re, sys
path, app_id = sys.argv[1], sys.argv[2]
xml = open(path, encoding="utf-8").read()
orig = xml

# 1. AdMob application ID meta-data inside <application>.
meta_re = re.compile(r'<meta-data\s+android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"[^>]*/>', re.S)
meta = '<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="%s"/>' % app_id
if meta_re.search(xml):
    xml = meta_re.sub(meta, xml)
else:
    m = re.search(r'<application\b[^>]*>', xml, re.S)
    if not m:
        sys.exit("ERROR: <application> tag not found")
    xml = xml[:m.end()] + "\n        " + meta + xml[m.end():]

# 2. screenOrientation="fullSensor" on the launcher activity (MainActivity).
act = re.search(r'<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*>', xml, re.S) or re.search(r'<activity\b[^>]*>', xml, re.S)
if not act:
    sys.exit("ERROR: <activity> tag not found")
tag = act.group(0)
if 'android:screenOrientation=' in tag:
    new_tag = re.sub(r'android:screenOrientation="[^"]*"', 'android:screenOrientation="fullSensor"', tag)
else:
    new_tag = tag.replace('<activity', '<activity\n            android:screenOrientation="fullSensor"', 1)
xml = xml.replace(tag, new_tag, 1)

# 3. Permissions.
for perm in ("android.permission.INTERNET", "com.android.vending.BILLING"):
    if ('android:name="%s"' % perm) not in xml:
        xml = xml.replace('</manifest>', '    <uses-permission android:name="%s" />\n</manifest>' % perm, 1)

if xml != orig:
    open(path, "w", encoding="utf-8").write(xml)
    print("Patched", path)
else:
    print("Already patched", path)
PY

grep -q 'com.google.android.gms.ads.APPLICATION_ID' "$MANIFEST" || { echo "ERROR: AdMob meta-data missing" >&2; exit 1; }
grep -q 'android:screenOrientation="fullSensor"' "$MANIFEST" || { echo "ERROR: screenOrientation missing" >&2; exit 1; }
echo "AndroidManifest OK (AdMob app id: $ADMOB_APP_ID)"
