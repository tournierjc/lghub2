#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="/usr/lib/lghub2"
BIN_PATH="/usr/local/bin/lghub2"
RULES_DIR="/etc/udev/rules.d"
DESKTOP_DIR="/usr/share/applications"
ICON_DIR="/usr/share/pixmaps"

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo $0"
  exit 1
fi

if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
  echo "Installing nodejs and npm..."
  pacman -S --needed --noconfirm nodejs npm
fi

if ! command -v electron &>/dev/null; then
  echo "Installing electron..."
  pacman -S --needed --noconfirm electron
fi

echo "==> Building lghub2..."
cd "$REPO_DIR"
npm ci

ELECTRON_VER=$(electron --version | sed 's/^v//')
echo "==> Rebuilding native modules for electron ${ELECTRON_VER}..."
./node_modules/.bin/electron-rebuild --version "$ELECTRON_VER"

npm run build
npm prune --omit=dev

echo "==> Installing to ${INSTALL_DIR}..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cp -r dist         "$INSTALL_DIR/"
cp -r data         "$INSTALL_DIR/"
cp -r assets       "$INSTALL_DIR/"
cp -r node_modules "$INSTALL_DIR/"

echo "==> Installing launcher..."
cat > "$BIN_PATH" << 'EOF'
#!/bin/bash
exec electron /usr/lib/lghub2/dist/main/main.js "$@"
EOF
chmod 755 "$BIN_PATH"

echo "==> Installing udev rules..."
cp "$REPO_DIR/packaging/70-lghub2.rules" "$RULES_DIR/70-lghub2.rules"
udevadm control --reload-rules
udevadm trigger --subsystem-match=hidraw

echo "==> Installing desktop entry and icon..."
cp "$REPO_DIR/packaging/lghub2.desktop" "$DESKTOP_DIR/lghub2.desktop"
cp "$REPO_DIR/assets/icon.png" "$ICON_DIR/lghub2.png"
update-desktop-database -q "$DESKTOP_DIR" 2>/dev/null || true

echo ""
echo "==> lghub2 installed successfully."
echo "    Run: lghub2"
echo "    Or launch from the KDE application menu."
echo ""
echo "    NOTE: udev rules have been applied. If your devices still show"
echo "    permission errors, log out and back in (or reboot)."
