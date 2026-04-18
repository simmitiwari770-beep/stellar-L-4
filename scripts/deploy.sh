#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# SoroSwap Deployment Script
# Deploys Token A, Token B, and Pool contracts to Stellar Testnet
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────
NETWORK="${SOROBAN_NETWORK:-testnet}"
RPC_URL="${SOROBAN_RPC_URL:-https://soroban-testnet.stellar.org}"
PASS="${SOROBAN_PASSPHRASE:-Test SDF Network ; September 2015}"

echo "═══════════════════════════════════════════════════════"
echo "  SoroSwap Contract Deployment"
echo "  Network: $NETWORK"
echo "═══════════════════════════════════════════════════════"

# ── Build contracts ───────────────────────────────────────────
echo ""
echo "▶ Using pre-compiled contracts..."

TOKEN_WASM="target/wasm32-unknown-unknown/release/soroswap_token.optimized.wasm"
VAULT_WASM="target/wasm32-unknown-unknown/release/soroswap_vault.optimized.wasm"

if [ ! -f "$TOKEN_WASM" ]; then
  echo "ERROR: Token WASM not found at $TOKEN_WASM"
  exit 1
fi
if [ ! -f "$VAULT_WASM" ]; then
  echo "ERROR: Vault WASM not found at $VAULT_WASM"
  exit 1
fi

# ── Check identity ────────────────────────────────────────────
IDENTITY="${SOROBAN_IDENTITY:-deployer}"
echo ""
echo "▶ Using identity: $IDENTITY"

ADMIN=$(stellar keys address "$IDENTITY" 2>/dev/null || true)
if [ -z "$ADMIN" ]; then
  echo "  No identity found. Generating new keypair..."
  stellar keys generate "$IDENTITY" --network "$NETWORK"
  ADMIN=$(stellar keys address "$IDENTITY")
  echo "  Admin address: $ADMIN"
  echo "  Funding via Friendbot..."
  curl -s "https://friendbot.stellar.org?addr=$ADMIN" > /dev/null
  echo "  Funded!"
else
  echo "  Admin: $ADMIN"
fi

# ── Upload WASMs ──────────────────────────────────────────────
echo ""
echo "▶ Uploading Token WASM..."
TOKEN_HASH=$(stellar contract upload \
  --wasm "$TOKEN_WASM" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS")
echo "  Token WASM hash: $TOKEN_HASH"

echo ""
echo "▶ Uploading Vault WASM..."
VAULT_HASH=$(stellar contract upload \
  --wasm "$VAULT_WASM" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS")
echo "  Vault WASM hash: $VAULT_HASH"

# ── Deploy Token ────────────────────────────────────────────
echo ""
echo "▶ Deploying Token (SST)..."
TOKEN_CONTRACT=$(stellar contract deploy \
  --wasm-hash "$TOKEN_HASH" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS")
echo "  Token contract: $TOKEN_CONTRACT"

# Initialize Token
stellar contract invoke \
  --id "$TOKEN_CONTRACT" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS" \
  -- initialize \
  --admin "$ADMIN" \
  --decimal 7 \
  --name "Stellar Custom Token" \
  --symbol SST
echo "  ✅ Token initialized"

# ── Deploy Vault ───────────────────────────────────────────────
echo ""
echo "▶ Deploying Vault..."
VAULT_CONTRACT=$(stellar contract deploy \
  --wasm-hash "$VAULT_HASH" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS")
echo "  Vault contract: $VAULT_CONTRACT"

stellar contract invoke \
  --id "$VAULT_CONTRACT" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS" \
  -- initialize \
  --token "$TOKEN_CONTRACT" \
  --reward_rate 10  # 10 tokens per 10000 per second

echo "  ✅ Vault initialized with Token=$TOKEN_CONTRACT"

# ── Mint initial tokens ───────────────────────────────────────
echo ""
echo "▶ Minting initial tokens to admin..."
MINT_AMOUNT=1000000000000  # 100,000 tokens (7 decimals)

stellar contract invoke \
  --id "$TOKEN_CONTRACT" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS" \
  -- mint --to "$ADMIN" --amount "$MINT_AMOUNT"

# Mint some to Vault for paying rewards
stellar contract invoke \
  --id "$TOKEN_CONTRACT" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS" \
  -- mint --to "$VAULT_CONTRACT" --amount "$MINT_AMOUNT"

echo "  ✅ Minted 100,000 SST to admin and Vault"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ DEPLOYMENT COMPLETE"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Admin address: $ADMIN"
echo "  Token Contract: $TOKEN_CONTRACT"
echo "  Vault contract: $VAULT_CONTRACT"
echo ""
echo "  Add to frontend/.env.local:"
echo "  NEXT_PUBLIC_TOKEN_CONTRACT=$TOKEN_CONTRACT"
echo "  NEXT_PUBLIC_VAULT_CONTRACT=$VAULT_CONTRACT"
echo ""
echo "  View on Explorer:"
echo "  https://stellar.expert/explorer/testnet/contract/$VAULT_CONTRACT"
echo "═══════════════════════════════════════════════════════"

# ── Write .env.local ──────────────────────────────────────────
ENV_FILE=".env.local"
cat > "$ENV_FILE" << EOF
NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_TOKEN_CONTRACT=$TOKEN_CONTRACT
NEXT_PUBLIC_VAULT_CONTRACT=$VAULT_CONTRACT
EOF
echo ""
echo "  ✅ Written to $ENV_FILE"
