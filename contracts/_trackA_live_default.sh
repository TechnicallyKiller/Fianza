#!/usr/bin/env bash
# Live adversarial default test — PART 2 (wait → default → record miss → verify).
# Runs in background; logs to _trackA_live.log. Robust to clock skew via retry.
source "$HOME/.profile"; export PATH="$HOME/.local/bin:$PATH"
set -u
exec > "$HOME/stellar/contracts/_trackA_live.log" 2>&1
S="$HOME/.local/bin/stellar"
VAULT=CA7QGIAUGENZU3V63CVUT2N56X3ASZ774E3RCAHFZ2WKAQGOCKTDIQOA
CREDIT=CC4ZAKREYMCDEONIQMSSBYOBFC75LL5NPYVEBRZ5SACHYWLYGK2R7GDO
REG=CAZUPW5MWHG5XCE7BM6YP6M52NPB6TPRRAXU3GEV4TL2AR2ZMYE7TRSX
source "$HOME/stellar/agents/.env"
source "$HOME/stellar/backend/.env"
SIGNER_SECRET="$SCORE_SIGNER_SECRET"
LENDER_PUB="$SCOUT_LENDER_PUBLIC"
AGENT=$(cat "$HOME/stellar/contracts/_trackA_live_agent.txt")
DEPLOYER=$("$S" keys address deployer)
DUE=1782992151

echo "AGENT=$AGENT  DUE=$DUE  DEPLOYER=$DEPLOYER"

echo "### wait until wall clock passes the due date"
now=$(date +%s)
while [ "$now" -le "$((DUE + 10))" ]; do sleep 15; now=$(date +%s); done
echo "past due at $(date +%s)"

echo "### mark_default (permissionless — caller = deployer, not the lender/agent)"
for i in $(seq 1 20); do
  out=$("$S" contract invoke --id "$VAULT" --source deployer --network testnet -- mark_default --agent "$AGENT" --caller "$DEPLOYER" 2>&1)
  echo "$out" | tail -6
  if echo "$out" | grep -q "Error(Contract, #6)"; then echo "(not overdue yet on-ledger, retrying)"; sleep 15; continue; fi
  break
done

echo "### record the missed repayment on-chain (signer) — collapses the ramp"
"$S" contract invoke --id "$REG" --source "$SIGNER_SECRET" --network testnet -- record_repayment --agent "$AGENT" --on_time false 2>&1 | tail -3

echo "### POST-DEFAULT STATE"
echo -n "state=";            "$S" contract invoke --id "$VAULT" --source deployer --network testnet -- state --agent "$AGENT" 2>&1 | tail -1
echo -n "lender_position=";  "$S" contract invoke --id "$VAULT" --source deployer --network testnet -- position --lender "$LENDER_PUB" --agent "$AGENT" 2>&1 | tail -1
echo -n "available_credit="; "$S" contract invoke --id "$VAULT" --source deployer --network testnet -- available_credit --agent "$AGENT" 2>&1 | tail -1
echo -n "get_repayments=";   "$S" contract invoke --id "$REG" --source deployer --network testnet -- get_repayments --agent "$AGENT" 2>&1 | tail -1
echo -n "credit_terms=";     "$S" contract invoke --id "$CREDIT" --source deployer --network testnet -- terms --agent "$AGENT" 2>&1 | tail -1

echo "### frozen: a defaulted agent cannot borrow again (expect Error #5 Defaulted)"
"$S" contract invoke --id "$VAULT" --source tl_defaulter --network testnet -- borrow --agent "$AGENT" --amount 1000000 2>&1 | grep -E "Error\(Contract" | tail -1

echo "### DONE"
