#!/bin/sh
# Installs the built app in /Applications. Copying over a running app leaves
# it unable to quit normally, so it is closed first (after its replies end).
# An old agent-desk.app (the app's first name) is closed and removed.
set -e
APP=/Applications/Elefante.app
OLD=/Applications/agent-desk.app
BUILT="$HOME/Library/Caches/elefante/dist/mac-arm64/Elefante.app"
running() { pgrep -f "$APP/Contents/MacOS/Elefante\$" >/dev/null || pgrep -f "$OLD/Contents/MacOS/agent-desk\$" >/dev/null; }
if running; then
  echo "Closing the running app…"
  for name in Elefante agent-desk; do
    osascript -e 'with timeout of 20 seconds' -e "tell application \"$name\" to quit" -e 'end timeout' >/dev/null 2>&1 || true
  done
  for _ in $(seq 1 30); do running || break; sleep 1; done
  if running; then echo "The app did not close. Quit it with ⌘Q and run this again." >&2; exit 1; fi
fi
ditto "$BUILT" "$APP"
if [ -d "$OLD" ]; then
  rm -rf "$OLD"
  osascript -e 'tell application "System Events" to delete login item "agent-desk"' >/dev/null 2>&1 || true
  echo "Removed the old agent-desk.app."
fi
echo "Instalado em $APP"
