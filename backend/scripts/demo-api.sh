#!/usr/bin/env bash
# End-to-end API demo: boot the server, hit every endpoint for one test agent,
# then shut it down — all in one shell so the server lifecycle is contained.
set -uo pipefail
cd "$(dirname "$0")/.."

AGENT=GCW6JEZSI64YMCARRROUPJVLIE5JFRNKRZVZYSKHQOQCVZN6RV3CYPAF
LEDGER=3326960
BASE=http://localhost:8787

pkill -f "src/index.ts" 2>/dev/null || true
sleep 1
npx tsx src/index.ts > /tmp/trustline-api.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT

# Wait for readiness.
for i in $(seq 1 30); do
  curl -sf "$BASE/health" >/dev/null 2>&1 && break
  sleep 1
done

pp() { node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.stringify(JSON.parse(d),null,2))}catch{console.log(d)}})'; }

echo "=== GET /health ===";  curl -s "$BASE/health" | pp
echo "=== GET /config ===";  curl -s "$BASE/config" | pp
echo "=== GET /agent/:addr/revenue ==="; curl -s "$BASE/agent/$AGENT/revenue?fromLedger=$LEDGER" | pp
echo "=== POST /agent/:addr/underwrite?skipProof=true ==="; curl -s -X POST "$BASE/agent/$AGENT/underwrite?skipProof=true&fromLedger=$LEDGER" | pp
echo "=== GET /agents ==="; curl -s "$BASE/agents" | pp
