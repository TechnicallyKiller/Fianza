#!/usr/bin/env bash
# Track A — redeploy credit_line + lending_vault with the new credit-risk engine,
# REUSING the existing score_registry so all published scores + repayment history
# (Scout, demo agents) are preserved. Registry is NOT redeployed.
set -euo pipefail
source "$HOME/.profile"
export PATH="$HOME/.local/bin:$PATH"
cd "$HOME/stellar/contracts"

S="$HOME/.local/bin/stellar"
W=target/wasm32v1-none/release
USDC=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
# Existing registry — preserved (holds Scout + demo-agent scores/history).
REG=CAZUPW5MWHG5XCE7BM6YP6M52NPB6TPRRAXU3GEV4TL2AR2ZMYE7TRSX
# Loan term for this deployment. Short (300s) so the live adversarial default
# test can watch a loan go overdue in minutes; a mainnet vault would use ~30d.
TERM=${TERM_SECS:-300}

echo "DEPLOYER=$($S keys address deployer)"
echo "REUSING REGISTRY=$REG"
echo "TERM_SECS=$TERM"

echo "--- deploying credit_line (ramp-aware) ---"
CL=$("$S" contract deploy --wasm "$W/credit_line.wasm" --source deployer --network testnet -- --registry "$REG" 2>/tmp/cl.err)
echo "CREDIT_LINE=$CL"
[ -z "$CL" ] && { echo "FAILED:"; tail -5 /tmp/cl.err; exit 1; }

echo "--- deploying lending_vault (risk engine) ---"
VA=$("$S" contract deploy --wasm "$W/lending_vault.wasm" --source deployer --network testnet -- --registry "$REG" --token "$USDC" --term_secs "$TERM" 2>/tmp/vault.err)
echo "VAULT=$VA"
[ -z "$VA" ] && { echo "FAILED:"; tail -5 /tmp/vault.err; exit 1; }

printf "REGISTRY=%s\nCREDIT_LINE=%s\nVAULT=%s\nTERM_SECS=%s\n" "$REG" "$CL" "$VA" "$TERM" > "$HOME/stellar/contracts/_trackA_ids.txt"
echo "--- saved to _trackA_ids.txt ---"
cat "$HOME/stellar/contracts/_trackA_ids.txt"
