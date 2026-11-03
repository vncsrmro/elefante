#!/bin/sh
# Installs or updates Elefante:
#   curl -fsSL https://raw.githubusercontent.com/vncsrmro/elefante/main/install.sh | bash
#
# On a Mac: the app (signed and notarized by Apple) goes into Applications; the
# "from the internet" mark is cleared all the same. Before its public release
# Elefante was called agent-desk: an old agent-desk.app is closed and replaced, and
# its data comes along the first time Elefante opens.
# On Linux: the .deb with apt (Ubuntu, Debian and their family), else the AppImage
# in ~/.local/bin with an entry in the applications menu.
#
# On Windows: install.ps1, in PowerShell (this says so).
#
# For testing a build before it is released (then the app doesn't open):
# ELEFANTE_ZIP (Mac), ELEFANTE_DEB or ELEFANTE_APPIMAGE (Linux; a URL or a local file)
# and ELEFANTE_DEST, another folder. ELEFANTE_APPIMAGE=1 picks the AppImage over the .deb.
set -e
REPO=vncsrmro/elefante
LATEST="https://github.com/$REPO/releases/latest/download"

# Messages in Portuguese on a system set to Portuguese, in English otherwise.
case "${LANG:-}" in pt*) PT=1 ;; *) PT= ;; esac
say() { if [ -n "$PT" ]; then echo "$1"; else echo "$2"; fi; }
fail() { say "$1" "$2" >&2; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
fetch() { # fetch <url or file> <to>
  case "$1" in
    http*) curl -fL --progress-bar -o "$2" "$1" ;;
    *) cp "$1" "$2" ;;
  esac
}

install_mac() {
  [ "$(uname -m)" = arm64 ] || fail "Por enquanto o Elefante é só pra Macs com chip Apple (M1 em diante)." "For now Elefante needs a Mac with Apple silicon (M1 or later)."
  ZIP="${ELEFANTE_ZIP:-$LATEST/elefante-mac-arm64.zip}"
  DEST="${ELEFANTE_DEST:-/Applications}"
  [ -w "$DEST" ] || [ -n "$ELEFANTE_DEST" ] || DEST="$HOME/Applications"
  mkdir -p "$DEST"
  APP="$DEST/Elefante.app"
  OLD="$DEST/agent-desk.app"

  say "Baixando o Elefante…" "Downloading Elefante…"
  fetch "$ZIP" "$TMP/elefante.zip"
  ditto -x -k "$TMP/elefante.zip" "$TMP/app"
  [ -d "$TMP/app/Elefante.app" ] || fail "O arquivo baixado não tem o Elefante.app." "The download doesn't contain Elefante.app."

  # Copying over a running app leaves it unable to quit normally: close it first.
  running() { pgrep -f "$APP/Contents/MacOS/Elefante\$" >/dev/null || pgrep -f "$OLD/Contents/MacOS/agent-desk\$" >/dev/null; }
  if running; then
    say "Fechando o app aberto…" "Closing the running app…"
    for name in Elefante agent-desk; do
      osascript -e 'with timeout of 20 seconds' -e "tell application \"$name\" to quit" -e 'end timeout' >/dev/null 2>&1 || true
    done
    for _ in $(seq 1 30); do running || break; sleep 1; done
    running && fail "O app não fechou. Feche com ⌘Q e rode de novo." "The app didn't close. Quit it with ⌘Q and run this again."
  fi

  rm -rf "$APP"
  ditto "$TMP/app/Elefante.app" "$APP"
  xattr -r -d com.apple.quarantine "$APP" >/dev/null 2>&1 || true
  if [ -d "$OLD" ] && [ -z "$ELEFANTE_DEST" ]; then
    rm -rf "$OLD"
    osascript -e 'tell application "System Events" to delete login item "agent-desk"' >/dev/null 2>&1 || true
  fi
  say "Instalado em $APP" "Installed in $APP"
  [ -n "$ELEFANTE_DEST" ] || open "$APP"
}

install_linux() {
  # The files carry each format's name for the architecture (amd64 .deb, x86_64 AppImage).
  case "$(uname -m)" in
    x86_64 | amd64) DEB=amd64 IMG=x86_64 ;;
    aarch64 | arm64) DEB=arm64 IMG=arm64 ;;
    *) fail "O Elefante roda em Linux x64 ou ARM64, não em $(uname -m)." "Elefante runs on x64 or ARM64 Linux, not on $(uname -m)." ;;
  esac

  # Replacing a running app's files leaves it broken: close it first (it quits on SIGTERM).
  # Only the app itself: a command line that starts with its path.
  running() { pgrep -f '^/opt/Elefante/elefante( |$)' >/dev/null || pgrep -f '^[^ ]*/Elefante\.AppImage( |$)' >/dev/null; }
  if running && [ -z "$ELEFANTE_DEST" ]; then
    say "Fechando o app aberto…" "Closing the running app…"
    pkill -TERM -f '^/opt/Elefante/elefante( |$)' 2>/dev/null || true
    pkill -TERM -f '^[^ ]*/Elefante\.AppImage( |$)' 2>/dev/null || true
    for _ in $(seq 1 30); do running || break; sleep 1; done
    running && fail "O app não fechou. Encerre o Elefante (ícone na bandeja › Encerrar) e rode de novo." "The app didn't close. Quit Elefante (tray icon › Quit) and run this again."
  fi

  if [ -z "${ELEFANTE_APPIMAGE:-}" ] && command -v apt-get >/dev/null 2>&1 && command -v dpkg >/dev/null 2>&1; then
    say "Baixando o Elefante (.deb)…" "Downloading Elefante (.deb)…"
    fetch "${ELEFANTE_DEB:-$LATEST/elefante-linux-$DEB.deb}" "$TMP/elefante.deb"
    chmod 644 "$TMP/elefante.deb"
    chmod 755 "$TMP"
    SUDO=
    if [ "$(id -u)" != 0 ]; then
      command -v sudo >/dev/null 2>&1 || fail "Precisa de sudo pra instalar o .deb. Rode como root, ou use ELEFANTE_APPIMAGE=1." "Installing the .deb needs sudo. Run as root, or use ELEFANTE_APPIMAGE=1."
      SUDO=sudo
      say "Instalando (o sistema pede a sua senha)…" "Installing (the system asks for your password)…"
    fi
    $SUDO apt-get install -y "$TMP/elefante.deb"
    APP=/opt/Elefante/elefante
  else
    DEST="${ELEFANTE_DEST:-$HOME/.local/bin}"
    mkdir -p "$DEST"
    APP="$DEST/Elefante.AppImage"
    case "${ELEFANTE_APPIMAGE:-}" in "" | 1) SRC="$LATEST/elefante-linux-$IMG.AppImage" ;; *) SRC="$ELEFANTE_APPIMAGE" ;; esac
    say "Baixando o Elefante (AppImage)…" "Downloading Elefante (AppImage)…"
    fetch "$SRC" "$TMP/Elefante.AppImage"
    chmod +x "$TMP/Elefante.AppImage"
    mv -f "$TMP/Elefante.AppImage" "$APP"
    if [ -z "$ELEFANTE_DEST" ]; then
      # In the applications menu, with the elephant (the AppImage's own icon, by its path).
      ICON="$HOME/.local/share/icons/elefante.png"
      mkdir -p "$(dirname "$ICON")" "$HOME/.local/share/applications"
      PNG=usr/share/icons/hicolor/1024x1024/apps/elefante.png
      (cd "$TMP" && env -u APPIMAGE_EXTRACT_AND_RUN "$APP" --appimage-extract "$PNG" >/dev/null 2>&1 && cp "squashfs-root/$PNG" "$ICON") || ICON=elefante
      cat > "$HOME/.local/share/applications/elefante.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Elefante
Comment=A team of AI agents on your computer
Exec="$APP" %U
Icon=$ICON
Terminal=false
Categories=Utility;
StartupWMClass=Elefante
EOF
      command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
    fi
  fi
  say "Instalado: $APP" "Installed: $APP"
  if [ -z "$ELEFANTE_DEST" ] && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
    nohup "$APP" >/dev/null 2>&1 &
  fi
}

case "$(uname -s)" in
  Darwin) install_mac ;;
  Linux) install_linux ;;
  MINGW* | MSYS* | CYGWIN*) fail "No Windows, instale pelo PowerShell: irm $LATEST/install.ps1 | iex" "On Windows, install from PowerShell: irm $LATEST/install.ps1 | iex" ;;
  *) fail "O Elefante roda no macOS, no Linux e no Windows." "Elefante runs on macOS, Linux and Windows." ;;
esac
