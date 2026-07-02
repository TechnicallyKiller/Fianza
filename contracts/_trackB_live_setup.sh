#!/usr/bin/env bash
# Track B live showcase — build a real CIRCULAR-FUNDING attacker on testnet.
# The attacker seeds two "customer" wallets from its OWN funds, then those
# wallets "pay" it back — manufacturing fake revenue in a loop. The independence
# engine (run by part 2) must trace the loop on-chain and count it as ZERO.
source "$HOME/.profile"; export PATH="$HOME/.local/bin:$PATH"
set -u
S="$HOME/.local/bin/stellar"
USDC=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
source "$HOME/stellar/agents/.env"
LENDER_SECRET="$SCOUT_LENDER_SECRET"   # our USDC source (Scout's lender, 5 USDC)
LENDER_PUB="$SCOUT_LENDER_PUBLIC"
OUT="$HOME/stellar/contracts/_trackB_ids.txt"

mk() { # identity name -> generate + friendbot-fund + USDC trustline; echo pubkey
  "$S" keys generate "$1" --network testnet --overwrite >/dev/null 2>&1
  "$S" keys fund "$1" --network testnet >/dev/null 2>&1
  "$S" tx new change-trust --source "$1" --line "USDC:$USDC_ISSUER" --network testnet >/dev/null 2>&1
  "$S" keys address "$1"
}
pay() { # source(identity-or-secret)  from-pubkey  to-pubkey  amount-stroops
  "$S" contract invoke --id "$USDC" --source "$1" --network testnet -- \
    transfer --from "$2" --to "$3" --amount "$4" >/dev/null 2>&1
}

echo "### create attacker A + two customer wallets C1, C2"
A=$(mk tlb_attacker)
C1=$(mk tlb_cust1)
C2=$(mk tlb_cust2)
echo "A=$A"; echo "C1=$C1"; echo "C2=$C2"

echo "### seed the attacker with 0.4 USDC of its OWN capital (from our lender)"
pay "$LENDER_SECRET" "$LENDER_PUB" "$A" 4000000
sleep 2

echo "### MARK the revenue window start (only activity AFTER here is 'revenue')"
FROM_LEDGER=$(curl -s "https://horizon-testnet.stellar.org/ledgers?order=desc&limit=1" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{console.log(JSON.parse(s)._embedded.records[0].sequence)})')
echo "FROM_LEDGER=$FROM_LEDGER"

echo "### the loop: attacker funds its 'customers' ..."
pay tlb_attacker "$A" "$C1" 2000000
pay tlb_attacker "$A" "$C2" 2000000
sleep 2
echo "### ... and the customers 'pay' the attacker back (fake revenue)"
pay tlb_cust1 "$C1" "$A" 2000000
pay tlb_cust2 "$C2" "$A" 2000000
sleep 3

printf "ATTACKER=%s\nCUST1=%s\nCUST2=%s\nFROM_LEDGER=%s\n" "$A" "$C1" "$C2" "$FROM_LEDGER" > "$OUT"
echo "### SETUP DONE"; cat "$OUT"
