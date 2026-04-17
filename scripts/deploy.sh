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
echo "▶ Building contracts (optimized)..."
stellar contract build --optimize

TOKEN_WASM="target/wasm32v1-none/release/soroswap_token.wasm"
POOL_WASM="target/wasm32v1-none/release/soroswap_pool.wasm"

if [ ! -f "$TOKEN_WASM" ]; then
  echo "ERROR: Token WASM not found at $TOKEN_WASM"
  exit 1
fi
if [ ! -f "$POOL_WASM" ]; then
  echo "ERROR: Pool WASM not found at $POOL_WASM"
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
echo "▶ Uploading Pool WASM..."
POOL_HASH=$(stellar contract upload \
  --wasm "$POOL_WASM" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS")
echo "  Pool WASM hash: $POOL_HASH"

# ── Deploy Token A ────────────────────────────────────────────
echo ""
echo "▶ Deploying Token A (SST)..."
TOKEN_A=$(stellar contract deploy \
  --wasm-hash "$TOKEN_HASH" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS")
echo "  Token A contract: $TOKEN_A"

# Initialize Token A
stellar contract invoke \
  --id "$TOKEN_A" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS" \
  -- initialize \
  --admin "$ADMIN" \
  --decimal 7 \
  --name "SoroSwap Token" \
  --symbol SST
echo "  ✅ Token A initialized"

# ── Deploy Token B ────────────────────────────────────────────
echo ""
echo "▶ Deploying Token B (USDC)..."
TOKEN_B=$(stellar contract deploy \
  --wasm-hash "$TOKEN_HASH" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS")
echo "  Token B contract: $TOKEN_B"

stellar contract invoke \
  --id "$TOKEN_B" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS" \
  -- initialize \
  --admin "$ADMIN" \
  --decimal 7 \
  --name "USD Coin (testnet)" \
  --symbol USDC
echo "  ✅ Token B initialized"

# ── Deploy Pool ───────────────────────────────────────────────
echo ""
echo "▶ Deploying Liquidity Pool..."
POOL=$(stellar contract deploy \
  --wasm-hash "$POOL_HASH" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS")
echo "  Pool contract: $POOL"

stellar contract invoke \
  --id "$POOL" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS" \
  -- initialize \
  --token-a "$TOKEN_A" \
  --token-b "$TOKEN_B" \
  --fee-to "$ADMIN"
echo "  ✅ Pool initialized with Token A=$TOKEN_A, Token B=$TOKEN_B"

# ── Mint initial tokens ───────────────────────────────────────
echo ""
echo "▶ Minting initial tokens to admin..."
MINT_AMOUNT=1000000000000  # 100,000 tokens (7 decimals)

stellar contract invoke \
  --id "$TOKEN_A" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS" \
  -- mint --to "$ADMIN" --amount "$MINT_AMOUNT"

stellar contract invoke \
  --id "$TOKEN_B" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASS" \
  -- mint --to "$ADMIN" --amount "$MINT_AMOUNT"
echo "  ✅ Minted 100,000 SST and 100,000 USDC to admin"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ DEPLOYMENT COMPLETE"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Admin address: $ADMIN"
echo "  Token A (SST): $TOKEN_A"
echo "  Token B (USDC): $TOKEN_B"
echo "  Pool contract: $POOL"
echo ""
echo "  Add to frontend/.env.local:"
echo "  NEXT_PUBLIC_TOKEN_A_CONTRACT=$TOKEN_A"
echo "  NEXT_PUBLIC_TOKEN_B_CONTRACT=$TOKEN_B"
echo "  NEXT_PUBLIC_POOL_CONTRACT=$POOL"
echo ""
echo "  View on Explorer:"
echo "  https://stellar.expert/explorer/testnet/contract/$POOL"
echo "═══════════════════════════════════════════════════════"

# ── Write .env.local ──────────────────────────────────────────
ENV_FILE="frontend/.env.local"
cat > "$ENV_FILE" << EOF
NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_TOKEN_A_CONTRACT=$TOKEN_A
NEXT_PUBLIC_TOKEN_B_CONTRACT=$TOKEN_B
NEXT_PUBLIC_POOL_CONTRACT=$POOL
EOF
echo ""
echo "  ✅ Written to $ENV_FILE"
