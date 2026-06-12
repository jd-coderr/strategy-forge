#!/bin/sh
set -e

echo "Starting Bergmann backend..."

export HOME=/data

mkdir -p "$HOME/.twak"

echo "TWAK HOME: $HOME"
echo "TWAK WALLET PATH: $HOME/.twak/wallet.json"

if [ ! -f "$HOME/.twak/wallet.json" ]; then
  echo "No TWAK wallet found. Creating headless wallet..."

  npx @trustwallet/cli wallet create \
    --password "$TWAK_WALLET_PASSWORD" \
    --no-keychain \
    --skip-password-check \
    --json
else
  echo "Existing TWAK wallet found."
fi

echo "TWAK wallet status:"
npx @trustwallet/cli wallet status --json || true

echo "Starting FastAPI..."
uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}