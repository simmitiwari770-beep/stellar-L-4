#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# SoroSwap Inter-Contract Interaction Demo
# Demonstrates: Token minting → Pool approval → Swap (cross-contract)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

NETWORK="${SOROBAN_NETWORK:-testnet}"
RPC_URL="${SOROBAN_RPC_URL:-https://soroban-testnet.stellar.org}"
PASS="${SOROBAN_PASSPHRASE:-Test SDF Network ; September 2015}"
IDENTITY="${SOROBAN_IDENTITY:-deployer}"

# Load from .env.local if not set
if [ -f "frontend/.env.local" ]; then
  export $(grep -v '^#' frontend/.env.local | xargs)
fi

TOKEN_A="${NEXT_PUBLIC_TOKEN_A_CONTRACT:-}"
TOKEN_B="${NEXT_PUBLIC_TOKEN_B_CONTRACT:-}"
POOL="${NEXT_PUBLIC_POOL_CONTRACT:-}"

if [ -z "$TOKEN_A" ] || [ -z "$TOKEN_B" ] || [ -z "$POOL" ]; then
  echo "ERROR: Contract addresses not set. Run deploy.sh first."
  exit 1
fi

ADMIN=$(stellar keys address "$IDENTITY")

echo "═══════════════════════════════════════════════════════"
echo "  SoroSwap Inter-Contract Interaction Demo"
echo "═══════════════════════════════════════════════════════"
echo "  Token A: $TOKEN_A"
echo "  Token B: $TOKEN_B"
echo "  Pool: $POOL"
echo ""

# Step 1: Check balances
echo "▶ Step 1: Check balances..."
BAL_A=$(stellar contract invoke --id "$TOKEN_A" --source "$IDENTITY" \
  --network "$NETWORK" -- balance --id "$ADMIN" 2>&1 | tr -d '"')
BAL_B=$(stellar contract invoke --id "$TOKEN_B" --source "$IDENTITY" \
  --network "$NETWORK" -- balance --id "$ADMIN" 2>&1 | tr -d '"')
echo "  SST balance: $BAL_A"
echo "  USDC balance: $BAL_B"

# Step 2: Approve Token A for pool (inter-contract setup)
echo ""
echo "▶ Step 2: Approve Token A for pool contract (inter-contract call)..."
APPROVE_AMOUNT=100000000000  # 10,000 tokens
EXPIRY=999999
APPROVE_TX=$(stellar contract invoke --id "$TOKEN_A" --source "$IDENTITY" \
  --network "$NETWORK" \
  -- approve \
  --from "$ADMIN" \
  --spender "$POOL" \
  --amount "$APPROVE_AMOUNT" \
  --expiration-ledger "$EXPIRY" 2>&1)
echo "  ✅ Token A approved for pool"

# Step 3: Approve Token B for pool
echo ""
echo "▶ Step 3: Approve Token B for pool..."
stellar contract invoke --id "$TOKEN_B" --source "$IDENTITY" \
  --network "$NETWORK" \
  -- approve \
  --from "$ADMIN" \
  --spender "$POOL" \
  --amount "$APPROVE_AMOUNT" \
  --expiration-ledger "$EXPIRY" > /dev/null
echo "  ✅ Token B approved for pool"

# Step 4: Add initial liquidity (pool calls token.transfer_from internally)
echo ""
echo "▶ Step 4: Add initial liquidity (INTER-CONTRACT CALL)..."
echo "  Pool will call token_a.transfer() and token_b.transfer()"
LP_TX=$(stellar contract invoke --id "$POOL" --source "$IDENTITY" \
  --network "$NETWORK" \
  -- add-liquidity \
  --provider "$ADMIN" \
  --amount-a 100000000000 \
  --amount-b 100000000000 2>&1)
echo "  ✅ Added 10,000 SST + 10,000 USDC liquidity"
echo "  LP minted: $LP_TX"

# Step 5: Get pool reserves
echo ""
echo "▶ Step 5: Check pool reserves..."
RESERVES=$(stellar contract invoke --id "$POOL" --source "$IDENTITY" \
  --network "$NETWORK" \
  -- get-reserves 2>&1)
echo "  Pool reserves: $RESERVES"

# Step 6: Swap SST → USDC (the core inter-contract call)
echo ""
echo "▶ Step 6: SWAP SST → USDC (INTER-CONTRACT CALL: pool → token_a → token_b)..."
echo "  Pool contract will:"
echo "    1. Call token_a.transfer() to receive SST from user"
echo "    2. Compute output using x*y=k formula"
echo "    3. Call token_b.transfer() to send USDC to user"
SWAP_TX=$(stellar contract invoke --id "$POOL" --source "$IDENTITY" \
  --network "$NETWORK" \
  -- swap \
  --user "$ADMIN" \
  --buy-b true \
  --amount-in 10000000000 \
  --min-out 0 2>&1)
echo "  ✅ SWAP COMPLETE"
echo "  Amount out: $SWAP_TX"
echo "  This proves inter-contract execution!"

# Final balances
echo ""
echo "▶ Final balances..."
BAL_A_FINAL=$(stellar contract invoke --id "$TOKEN_A" --source "$IDENTITY" \
  --network "$NETWORK" -- balance --id "$ADMIN" 2>&1 | tr -d '"')
BAL_B_FINAL=$(stellar contract invoke --id "$TOKEN_B" --source "$IDENTITY" \
  --network "$NETWORK" -- balance --id "$ADMIN" 2>&1 | tr -d '"')
echo "  SST: $BAL_A → $BAL_A_FINAL (decreased by swap)"
echo "  USDC: $BAL_B → $BAL_B_FINAL (increased by swap)"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ INTER-CONTRACT CALLS DEMONSTRATED SUCCESSFULLY"
echo "  Pool ↔ Token A ↔ Token B interactions complete"
echo "═══════════════════════════════════════════════════════"
