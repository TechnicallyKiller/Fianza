#!/usr/bin/env bash
# Phase 4a — deploy the three TrustLine contracts to testnet.
source "$HOME/.profile"
export PATH="$HOME/.local/bin:$PATH"
cd "$HOME/stellar/contracts" || exit 1

S="$HOME/.local/bin/stellar"
W=target/wasm32v1-none/release
DEPLOYER=$("$S" keys address deployer)
SIGNER=GCNFNO4A4WPHUNNT3YJ36J4NIW4SV46XNO35Y355TMJF6DVPVXM3KWXF
USDC=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA

echo "DEPLOYER=$DEPLOYER"

echo "--- deploying score_registry ---"
REG=$("$S" contract deploy --wasm "$W/score_registry.wasm" --source deployer --network testnet -- --admin "$DEPLOYER" --signer "$SIGNER" 2>/tmp/reg.err)
echo "REGISTRY=$REG"
[ -z "$REG" ] && { echo "FAILED:"; tail -5 /tmp/reg.err; exit 1; }

echo "--- deploying credit_line ---"
CL=$("$S" contract deploy --wasm "$W/credit_line.wasm" --source deployer --network testnet -- --registry "$REG" 2>/tmp/cl.err)
echo "CREDIT_LINE=$CL"
[ -z "$CL" ] && { echo "FAILED:"; tail -5 /tmp/cl.err; exit 1; }

echo "--- deploying lending_vault ---"
VA=$("$S" contract deploy --wasm "$W/lending_vault.wasm" --source deployer --network testnet -- --registry "$REG" --token "$USDC" 2>/tmp/vault.err)
echo "VAULT=$VA"
[ -z "$VA" ] && { echo "FAILED:"; tail -5 /tmp/vault.err; exit 1; }

printf "REGISTRY=%s\nCREDIT_LINE=%s\nVAULT=%s\n" "$REG" "$CL" "$VA" > "$HOME/stellar/contracts/_phase4_ids.txt"
echo "--- saved to _phase4_ids.txt ---"
