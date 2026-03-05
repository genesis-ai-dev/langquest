#!/usr/bin/env bash
set -euo pipefail

# One-time setup: downloads a rootable (Google APIs, no Play Store) system image
# and creates a dedicated AVD for network testing.
#
# Usage: bash tools/network-control/setup.sh

ANDROID_SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
SDKMANAGER="$ANDROID_SDK/cmdline-tools/latest/bin/sdkmanager"
AVDMANAGER="$ANDROID_SDK/cmdline-tools/latest/bin/avdmanager"

IMAGE="system-images;android-35;google_apis;arm64-v8a"
AVD_NAME="LangQuest_NetTest"
DEVICE="pixel_6"

if [ ! -x "$SDKMANAGER" ]; then
  echo "ERROR: sdkmanager not found at $SDKMANAGER"
  echo "Install Android SDK command-line tools via Android Studio → Settings → SDK Tools."
  exit 1
fi

echo "==> Downloading system image: $IMAGE"
echo "    (This may take a few minutes on first run)"
"$SDKMANAGER" "$IMAGE"

echo ""
echo "==> Creating AVD: $AVD_NAME"

if "$AVDMANAGER" list avd -c 2>/dev/null | grep -qx "$AVD_NAME"; then
  echo "    AVD '$AVD_NAME' already exists — skipping creation."
else
  echo "no" | "$AVDMANAGER" create avd \
    -n "$AVD_NAME" \
    -k "$IMAGE" \
    -d "$DEVICE"
  echo "    Created AVD '$AVD_NAME'."
fi

echo ""
echo "==> Setup complete."
echo ""
echo "    Launch the emulator:  npm run emulator:nettest"
echo "    Open control panel:   npm run network-control"
echo ""
echo "    NOTE: This AVD uses a Google APIs image (no Play Store)."
echo "    This allows 'adb root' which is required for tc/iptables network control."
