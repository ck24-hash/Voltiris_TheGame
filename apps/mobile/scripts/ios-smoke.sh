#!/usr/bin/env bash
# Plays the game in an iPhone Simulator (macOS only; used by the iOS workflow).
# Expects a debug build made with VITE_TIME_SPEED=240 VITE_DEBUG=1.
#
#   1. First launch: a new game starts and saves itself to a file.
#   2. The app is closed for 30 s, which is 2 hours of game time at 240x.
#   3. Second launch: the save loads and "Welcome back!" sums up the break.
#
# Screenshots, console logs and the save files land in the output folder.
# Fails if the app logs a JavaScript error or never writes a save.
#
# Usage: ios-smoke.sh <path to App.app> <output folder>
set -euo pipefail

APP="$1"
OUT="$2"
BUNDLE=com.voltiris.thegame
mkdir -p "$OUT"

# The newest iPhone available.
DEVICE=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devices = json.load(sys.stdin)["devices"]
phones = [(runtime, d) for runtime, ds in devices.items() if "iOS" in runtime
          for d in ds if d["name"].startswith("iPhone")]
runtime, device = sorted(phones, key=lambda p: p[0])[-1]
print(device["udid"])
print(device["name"], runtime.rsplit(".", 1)[-1], file=sys.stderr)
')
echo "Simulator: $DEVICE"
xcrun simctl boot "$DEVICE"
xcrun simctl bootstatus "$DEVICE" -b > /dev/null
xcrun simctl install "$DEVICE" "$APP"

# Launches the game, lets it run, takes a screenshot and closes it.
play() {
  local name="$1" seconds="$2"
  xcrun simctl launch --console-pty "$DEVICE" "$BUNDLE" > "$OUT/$name.log" 2>&1 &
  local console=$!
  sleep "$seconds"
  xcrun simctl io "$DEVICE" screenshot "$OUT/$name.png"
  xcrun simctl terminate "$DEVICE" "$BUNDLE" || true
  wait "$console" || true
  # The game is landscape-only; turn the portrait screenshot to match.
  sips -r 270 "$OUT/$name.png" > /dev/null
}

play first-launch 45
sleep 30
play relaunch 30

SAVES="$(xcrun simctl get_app_container "$DEVICE" "$BUNDLE" data)/Library/saves"
cp -R "$SAVES" "$OUT/saves" 2>/dev/null || true

echo "--- Game console"
grep -h -E "\[app\]|\[fps\]|\[save\]|\[error\]" "$OUT"/*.log || true

status=0
if grep -h "\[error\]" "$OUT"/*.log | grep -v "RENDER WARNING"; then
  echo "::error::The game logged JavaScript errors (see above)."
  status=1
fi
if [ ! -f "$OUT/saves/save-0.json" ]; then
  echo "::error::No save file was written to Library/saves."
  status=1
fi
exit "$status"
