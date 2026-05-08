#!/usr/bin/env bash
# =============================================================================
# PhantomID — Anchor Contract Deploy Script
# =============================================================================
# Usage:
#   chmod +x blockchain/anchor_contract/deploy.sh
#   cd blockchain/anchor_contract
#   ./deploy.sh
#
# Prerequisites:
#   - Rust + Cargo installed (rustup.rs)
#   - Anchor CLI installed (npm install -g @coral-xyz/anchor-cli)
#   - Solana CLI installed (solana-install init)
#   - Devnet wallet funded (solana airdrop 2 --url devnet)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================"
echo " PhantomID Anchor Deploy — Solana Devnet"
echo "============================================"

# 1. Ensure we're on devnet
echo "[1/5] Setting Solana cluster to devnet..."
solana config set --url devnet

# 2. Show wallet & balance
echo "[2/5] Wallet info:"
solana address
BALANCE=$(solana balance 2>/dev/null || echo "0 SOL")
echo "Balance: $BALANCE"

# 3. Build the program
echo "[3/5] Building Anchor program..."
anchor build

# 4. Extract the generated program ID
PROGRAM_ID=$(solana-keygen pubkey target/deploy/phantom_anchor-keypair.json 2>/dev/null || true)
if [[ -z "$PROGRAM_ID" ]]; then
  echo "ERROR: Could not read program ID from keypair. Run 'anchor keys list' after build."
  exit 1
fi
echo "[3/5] Program ID: $PROGRAM_ID"

# 5. Patch the declare_id! in lib.rs and Anchor.toml with the real program ID
sed -i "s/PhAnToMiDpRoGrAmIdPLACEHOLDER11111111111111/$PROGRAM_ID/g" \
  programs/phantom_anchor/src/lib.rs \
  Anchor.toml

# 6. Rebuild with the real program ID embedded
echo "[4/5] Rebuilding with embedded program ID..."
anchor build

# 7. Deploy
echo "[5/5] Deploying to Solana devnet..."
anchor deploy --provider.cluster devnet

echo ""
echo "============================================"
echo " Deploy complete!"
echo " Program ID: $PROGRAM_ID"
echo " Explorer:   https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
echo "============================================"
echo ""
echo "NEXT STEP: Set this in your .env file:"
echo "  ANCHOR_PROGRAM_ID=$PROGRAM_ID"
