#!/bin/sh
set -eu

BIN="/data/cloudflared"
LOG="/tmp/cloudflared.log"
TARGET_URL="${FILMIO_TARGET_URL:-http://filmio-stream:8769}"
BRIDGE_API="${FILMIO_BRIDGE_API:-https://filmio.my/api/tv-bridge}"

mkdir -p /data
if [ ! -x "$BIN" ]; then
  echo "[FilmioTunnel] Downloading cloudflared linux-amd64..."
  curl -fSL -o "$BIN" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
  chmod +x "$BIN"
fi

register_url() {
  URL="$1"
  for attempt in 1 2 3 4 5; do
    RESP=$(curl -sS --max-time 10 -X POST "$BRIDGE_API" \
      -H "Content-Type: application/json" \
      -d "{\"bridgeUrl\":\"$URL\"}" 2>&1 || true)
    if echo "$RESP" | grep -q '"ok":true'; then
      echo "[FilmioTunnel] Registered live QNAP bridge on filmio.my: $URL"
      return 0
    fi
    echo "[FilmioTunnel] Register attempt $attempt failed: $RESP"
    sleep 3
  done
  return 1
}

while true; do
  rm -f "$LOG"
  echo "[FilmioTunnel] Starting 24/7 HTTPS tunnel -> $TARGET_URL"
  "$BIN" tunnel --no-autoupdate --url "$TARGET_URL" > "$LOG" 2>&1 &
  CF_PID=$!

  TUNNEL_URL=""
  for i in $(seq 1 40); do
    if ! kill -0 "$CF_PID" 2>/dev/null; then
      echo "[FilmioTunnel] cloudflared exited early, retrying..."
      break
    fi
    TUNNEL_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | head -n 1 || true)
    if [ -n "$TUNNEL_URL" ]; then
      break
    fi
    sleep 1
  done

  if [ -z "$TUNNEL_URL" ]; then
    echo "[FilmioTunnel] Could not obtain tunnel URL, restarting..."
    kill "$CF_PID" 2>/dev/null || true
    wait "$CF_PID" 2>/dev/null || true
    sleep 5
    continue
  fi

  echo "$TUNNEL_URL" > /data/current_tunnel_url.txt
  sleep 2
  register_url "$TUNNEL_URL" || true

  FAILS=0
  SYNC_TICK=0
  while kill -0 "$CF_PID" 2>/dev/null; do
    sleep 60
    SYNC_TICK=$((SYNC_TICK + 1))
    if curl -sf --max-time 12 "$TUNNEL_URL/health" >/dev/null 2>&1; then
      FAILS=0
      if [ $((SYNC_TICK % 30)) -eq 0 ]; then
        register_url "$TUNNEL_URL" || true
      fi
    else
      FAILS=$((FAILS + 1))
      echo "[FilmioTunnel] Health check failed ($FAILS/3) for $TUNNEL_URL"
      if [ "$FAILS" -ge 3 ]; then
        echo "[FilmioTunnel] Restarting unhealthy tunnel..."
        kill "$CF_PID" 2>/dev/null || true
        break
      fi
    fi
  done

  wait "$CF_PID" 2>/dev/null || true
  sleep 3
done
