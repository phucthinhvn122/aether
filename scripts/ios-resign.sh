#!/usr/bin/env bash
# Signs an unsigned App.app with a .p12 certificate + .mobileprovision and packages an IPA (macOS only).
# Usage: scripts/ios-resign.sh <App.app> <cert.p12> <p12-password> <profile.mobileprovision> <out.ipa>
set -euo pipefail

SRC_APP="$1"
P12="$2"
P12_PASS="$3"
PROFILE="$4"
OUT="$(cd "$(dirname "$5")" && pwd)/$(basename "$5")"
PB=/usr/libexec/PlistBuddy

WORK="$(mktemp -d)"
KEYCHAIN="$WORK/signing.keychain-db"
KC_PASS="$(uuidgen)"
trap 'security delete-keychain "$KEYCHAIN" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

mkdir -p "$WORK/Payload"
cp -R "$SRC_APP" "$WORK/Payload/"
APP="$WORK/Payload/$(basename "$SRC_APP")"

security create-keychain -p "$KC_PASS" "$KEYCHAIN"
security set-keychain-settings -lut 3600 "$KEYCHAIN"
security unlock-keychain -p "$KC_PASS" "$KEYCHAIN"
security import "$P12" -k "$KEYCHAIN" -P "$P12_PASS" -f pkcs12 -T /usr/bin/codesign
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KC_PASS" "$KEYCHAIN" >/dev/null
security list-keychains -d user -s "$KEYCHAIN" "$HOME/Library/Keychains/login.keychain-db"

IDENTITY="$(security find-identity -v -p codesigning "$KEYCHAIN" | awk 'NR==1 && $2 ~ /^[0-9A-F]{40}$/ {print $2}')"
if [ -z "$IDENTITY" ]; then
  echo "::error::No valid code-signing identity in the .p12 (wrong password, expired or revoked certificate?)"
  exit 1
fi

security cms -D -i "$PROFILE" > "$WORK/profile.plist"
TEAM="$($PB -c 'Print :TeamIdentifier:0' "$WORK/profile.plist")"
APP_ID="$($PB -c 'Print :Entitlements:application-identifier' "$WORK/profile.plist")"
PROFILE_BUNDLE="${APP_ID#"$TEAM".}"
CURRENT_BUNDLE="$($PB -c 'Print :CFBundleIdentifier' "$APP/Info.plist")"

# Explicit profiles dictate the bundle id; wildcard profiles ("*" or "com.foo.*") keep/derive one.
case "$PROFILE_BUNDLE" in
  '*') BUNDLE_ID="$CURRENT_BUNDLE" ;;
  *'*') BUNDLE_ID="${PROFILE_BUNDLE%\*}aether" ;;
  *) BUNDLE_ID="$PROFILE_BUNDLE" ;;
esac
$PB -c "Set :CFBundleIdentifier $BUNDLE_ID" "$APP/Info.plist"

$PB -x -c 'Print :Entitlements' "$WORK/profile.plist" > "$WORK/entitlements.plist"
$PB -c "Set :application-identifier $TEAM.$BUNDLE_ID" "$WORK/entitlements.plist"
cp "$PROFILE" "$APP/embedded.mobileprovision"

for fw in "$APP"/Frameworks/*; do
  [ -e "$fw" ] && codesign --force --sign "$IDENTITY" --keychain "$KEYCHAIN" --timestamp=none "$fw"
done
codesign --force --sign "$IDENTITY" --keychain "$KEYCHAIN" --entitlements "$WORK/entitlements.plist" --timestamp=none "$APP"
codesign --verify --deep --strict "$APP"

(cd "$WORK" && rm -f "$OUT" && zip -qry "$OUT" Payload)

PROFILE_NAME="$($PB -c 'Print :Name' "$WORK/profile.plist")"
EXPIRES="$($PB -c 'Print :ExpirationDate' "$WORK/profile.plist")"
if $PB -c 'Print :ProvisionsAllDevices' "$WORK/profile.plist" >/dev/null 2>&1; then
  KIND="enterprise (all devices)"
elif $PB -c 'Print :ProvisionedDevices' "$WORK/profile.plist" >/dev/null 2>&1; then
  KIND="ad-hoc/development ($($PB -c 'Print :ProvisionedDevices' "$WORK/profile.plist" | grep -c '^ ') registered devices)"
else
  KIND="app-store (not installable directly — use TestFlight)"
fi
echo "Signed $BUNDLE_ID with profile \"$PROFILE_NAME\" [$KIND], expires $EXPIRES"
echo "Output: $OUT"
