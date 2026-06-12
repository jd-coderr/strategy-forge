#!/bin/sh

echo "Starting Bergmann backend..."

export HOME=/root

mkdir -p /root/.twak

echo "TWAK HOME: $HOME"
echo "TWAK WALLET PATH: /root/.twak/wallet.json"

if [ ! -f /root/.twak/wallet.json ]; then
  echo "No TWAK wallet found. Creating headless wallet..."

  npx @trustwallet/cli wallet create \
    --password "$TWAK_WALLET_PASSWORD" \
    --no-keychain \
    --skip-password-check \
    --json || true
else
  echo "Existing TWAK wallet found."
fi

echo "TWAK wallet status:"
npx @trustwallet/cli wallet status --json || true

echo "TWAK BSC address:"
npx @trustwallet/cli wallet address \
  --chain bsc \
  --password "$TWAK_WALLET_PASSWORD" \
  --json || true

echo "Starting FastAPI..."
uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}