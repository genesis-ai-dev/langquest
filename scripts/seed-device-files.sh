#!/usr/bin/env bash
# Plants seeded audio files on an Android device/emulator so they enter the
# attachment upload queue. Companion to scripts/seed-attachment-load.ts,
# which produces the filename manifest.
#
# Generates one small valid WAV locally, pushes it once, then copies it
# on-device (fast) under every manifest filename into the app's
# shared_attachments directory — the same directory both the old attachment
# queue and the new audio sync workers use.
#
# Requires a debuggable build (the Expo dev client is), since it uses run-as.
#
# Usage:
#   ./scripts/seed-device-files.sh [manifest] [package] [size_kb]
#     manifest  default /tmp/langquest-seed-manifest.txt
#     package   default com.etengenesis.langquest.preview
#     size_kb   default 60 (approx per-file size; affects upload duration)

set -euo pipefail

MANIFEST="${1:-/tmp/langquest-seed-manifest.txt}"
PACKAGE="${2:-com.etengenesis.langquest.preview}"
SIZE_KB="${3:-60}"

if [[ ! -f "$MANIFEST" ]]; then
  echo "❌ Manifest not found: $MANIFEST (run seed-attachment-load.ts first)" >&2
  exit 1
fi

COUNT=$(grep -c . "$MANIFEST")
echo "🚀 Planting $COUNT files (~${SIZE_KB}KB each) into $PACKAGE"

# Valid PCM WAV of the requested size: 44-byte header + silence.
SEED_WAV=/tmp/langquest-seed.wav
node -e "
const fs = require('fs');
const dataSize = ${SIZE_KB} * 1024 - 44;
const buf = Buffer.alloc(44 + dataSize);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4);
buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);            // fmt chunk size
buf.writeUInt16LE(1, 20);             // PCM
buf.writeUInt16LE(1, 22);             // mono
buf.writeUInt32LE(16000, 24);         // sample rate
buf.writeUInt32LE(32000, 28);         // byte rate
buf.writeUInt16LE(2, 32);             // block align
buf.writeUInt16LE(16, 34);            // bits per sample
buf.write('data', 36); buf.writeUInt32LE(dataSize, 40);
fs.writeFileSync('$SEED_WAV', buf);
"

adb push "$SEED_WAV" /data/local/tmp/seed.wav >/dev/null
adb push "$MANIFEST" /data/local/tmp/seed-manifest.txt >/dev/null
adb shell chmod 644 /data/local/tmp/seed.wav /data/local/tmp/seed-manifest.txt

# Copy loop runs entirely on-device under the app's uid.
COPY_SCRIPT=/tmp/langquest-seed-copy.sh
cat > "$COPY_SCRIPT" <<'EOS'
mkdir -p files/shared_attachments
n=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  cp /data/local/tmp/seed.wav "files/shared_attachments/$f"
  n=$((n + 1))
  [ $((n % 1000)) -eq 0 ] && echo "  copied $n..."
done < /data/local/tmp/seed-manifest.txt
echo "  copied $n files total"
EOS
adb push "$COPY_SCRIPT" /data/local/tmp/seed-copy.sh >/dev/null
adb shell chmod 644 /data/local/tmp/seed-copy.sh

adb shell run-as "$PACKAGE" sh /data/local/tmp/seed-copy.sh

TOTAL=$(adb shell run-as "$PACKAGE" ls files/shared_attachments | wc -l | tr -d ' ')
echo "✅ shared_attachments now holds $TOTAL entries"

rm -f "$SEED_WAV" "$COPY_SCRIPT"
