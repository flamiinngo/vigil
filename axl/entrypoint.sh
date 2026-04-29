#!/bin/sh
# Generate or restore private key
if [ -n "$AXL_PRIVATE_KEY_B64" ]; then
    echo "$AXL_PRIVATE_KEY_B64" | base64 -d > private.pem
    echo "[AXL] Loaded private key from env"
else
    openssl genpkey -algorithm ed25519 -out private.pem
    echo "[AXL] Generated new private key — save the public key below as your node identity"
fi

echo "[AXL] Starting Vigil AXL node..."
./node -config node-config.json
