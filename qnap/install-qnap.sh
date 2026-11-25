#!/bin/sh
set -eu

# Filmio 24/7 Stream Server installer for QNAP TS-253Be (Container Station / Docker)
# Usage on QNAP SSH:
#   sh /share/Container/filmio/qnap/install-qnap.sh

INSTALL_DIR="${FILMIO_QNAP_DIR:-/share/Container/filmio}"
REPO_URL="https://github.com/jeka7ro/radio.git"

echo "[Filmio-QNAP] Target directory: $INSTALL_DIR"
mkdir -p "$(dirname "$INSTALL_DIR")"

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "[Filmio-QNAP] Updating existing repository..."
  cd "$INSTALL_DIR"
  git fetch origin main
  git reset --hard origin/main
else
  echo "[Filmio-QNAP] Cloning repository..."
  git clone --depth 1 -b main "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

mkdir -p "$INSTALL_DIR/qnap/data/torrent-cache" \
         "$INSTALL_DIR/qnap/data/caddy_data" \
         "$INSTALL_DIR/qnap/data/caddy_config"

cd "$INSTALL_DIR/qnap"

if docker compose version >/dev/null 2>&1; then
  docker compose up -d --build --remove-orphans
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose up -d --build --remove-orphans
else
  echo "[Filmio-QNAP] ERROR: docker compose / docker-compose not found. Install Container Station first."
  exit 1
fi

echo ""
echo "[Filmio-QNAP] Containers started! Checking local health..."
sleep 3
curl -sS http://127.0.0.1:8769/health || true
echo ""
echo "[Filmio-QNAP] Done! Ensure Router forwards 80->8480 and 443->8443 to this QNAP IP, and Porkbun DNS points stream.filmio.my here."
