#!/usr/bin/env bash
# =============================================================================
# android/build_apk.sh — Gera release/StitchedWorlds.apk (um único APK, offline).
# Pipeline sem Gradle: build JS (esbuild) -> aapt2 (recursos + manifest + assets)
# -> javac -> d8 (dex) -> zipalign -> apksigner (v1+v2+v3).
# Requer: Android SDK em $ANDROID_HOME (padrão /opt/android-sdk) com
# platforms;android-35 e build-tools;35.0.0, JDK 17+, Node.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
SDK="${ANDROID_HOME:-/opt/android-sdk}"
BT="$SDK/build-tools/35.0.0"
JAR="$SDK/platforms/android-35/android.jar"
B="$ROOT/android/build"
VERSION_NAME="${VERSION_NAME:-1.0.0}"
VERSION_CODE="${VERSION_CODE:-$(date +%y%m%d%H)}"
KS="${KEYSTORE:-$ROOT/android/keystore/stitched-worlds.jks}"
KS_PASS="${KEYSTORE_PASS:-stitchedworlds}"

echo "== 1/7 bundle JS"
node tools/build.mjs
rm -rf "$B"; mkdir -p "$B/res" "$B/compiled" "$B/classes" "$B/dex" "$B/assets"
cp -r android/res/. "$B/res/"
cp dist/index.html dist/game.js "$B/assets/"

echo "== 2/7 icons"
node android/make_icons.mjs "$B/res"

echo "== 3/7 aapt2 compile + link"
"$BT/aapt2" compile --dir "$B/res" -o "$B/compiled/res.zip"
"$BT/aapt2" link -o "$B/unsigned.apk" -I "$JAR" \
  --manifest android/AndroidManifest.xml \
  --min-sdk-version 24 --target-sdk-version 35 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -A "$B/assets" "$B/compiled/res.zip" --auto-add-overlay

echo "== 4/7 javac"
javac --release 11 -nowarn -classpath "$JAR" -d "$B/classes" $(find android/src -name '*.java') 2>&1 | grep -v "^Note:" || true
test -f "$B/classes/com/stitchedworlds/game/MainActivity.class"

echo "== 5/7 d8"
"$BT/d8" --release --min-api 24 --lib "$JAR" --output "$B/dex" $(find "$B/classes" -name '*.class')
(cd "$B/dex" && zip -q -j "$B/unsigned.apk" classes.dex)

echo "== 6/7 zipalign"
"$BT/zipalign" -p -f 4 "$B/unsigned.apk" "$B/aligned.apk"

echo "== 7/7 sign"
if [ ! -f "$KS" ]; then
  mkdir -p "$(dirname "$KS")"
  keytool -genkeypair -v -keystore "$KS" -alias stitched -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=Stitched Worlds, O=Stitched Worlds, C=BR" >/dev/null 2>&1
fi
mkdir -p release
"$BT/apksigner" sign --ks "$KS" --ks-key-alias stitched --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --v4-signing-enabled false \
  --out release/StitchedWorlds.apk "$B/aligned.apk"
"$BT/apksigner" verify --verbose release/StitchedWorlds.apk | head -5
ls -la release/StitchedWorlds.apk
echo "APK pronto: release/StitchedWorlds.apk"
