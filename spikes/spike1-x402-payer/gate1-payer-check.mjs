// GATE 1: does the on-chain USDC SAC `transfer` event record the AGENT (payer)
// as `from`, or the facilitator? Reads settlement.json (written by client.js),
// queries getEvents on the USDC testnet SAC, decodes topics, prints the verdict.
// TESTNET ONLY.
import "./load-env.mjs";
import fs from "node:fs";
import {
  rpc, xdr, scValToNative, TransactionBuilder, Networks,
} from "@stellar/stellar-sdk";

const RPC_URL = process.env.RPC_URL || "https://soroban-testnet.stellar.org";
const USDC_SAC = process.env.USDC_TESTNET_SAC || "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const AGENT = process.env.AGENT_PUBLIC;

const server = new rpc.Server(RPC_URL, { allowHttp: false });

function nativeTopic(t) {
  // getEvents topics may come back as base64 XDR strings or xdr.ScVal objects.
  const sv = typeof t === "string" ? xdr.ScVal.fromXDR(t, "base64") : t;
  return scValToNative(sv);
}

async function main() {
  if (!fs.existsSync("settlement.json")) {
    throw new Error("settlement.json not found — run `node client.js` (one paid request) first.");
  }
  const s = JSON.parse(fs.readFileSync("settlement.json", "utf8"));
  const txHash = s.txHash;
  if (!txHash) throw new Error("No txHash in settlement.json — inspect settlement.headers.");
  console.log("Settlement tx hash:", txHash);

  // 1) locate the tx ledger + the facilitator (tx source / fee payer).
  let tx;
  for (let i = 0; i < 12; i++) {
    tx = await server.getTransaction(txHash);
    if (tx.status === "SUCCESS") break;
    console.log(`getTransaction status=${tx.status} (attempt ${i + 1}); waiting for RPC to index...`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (tx.status !== "SUCCESS") {
    throw new Error(`tx ${txHash} not SUCCESS after retries (status=${tx.status}).`);
  }
  const ledger = tx.ledger;
  console.log("Ledger sequence:", ledger);

  // Facilitator = whoever submitted + paid fees. Horizon is authoritative and also
  // exposes the fee-bump fee_account (the OZ Channels fee sponsor). Fall back to the
  // RPC envelope source if Horizon is unavailable.
  let facilitator = "(unknown)";
  let feeAccount = null;
  try {
    const HORIZON = process.env.HORIZON_URL || "https://horizon-testnet.stellar.org";
    const h = await (await fetch(`${HORIZON}/transactions/${txHash}`)).json();
    facilitator = h.source_account;       // inner tx source / submitter
    feeAccount = h.fee_account || null;    // fee-bump sponsor (OZ Channels)
  } catch (e) {
    try {
      const envB64 = tx.envelopeXdr?.toXDR ? tx.envelopeXdr.toXDR("base64") : tx.envelopeXdr;
      facilitator = TransactionBuilder.fromXDR(envB64, Networks.TESTNET).source;
    } catch (e2) {
      console.log("could not derive facilitator:", e.message, "/", e2.message);
    }
  }

  // 2) getEvents on the USDC SAC. ALL FOUR topic segments required or RPC returns nothing.
  const transferSym = xdr.ScVal.scvSymbol("transfer").toXDR("base64");
  const startLedger = Math.max(1, ledger - 5);
  const params = {
    startLedger,
    filters: [
      {
        type: "contract",
        contractIds: [USDC_SAC],
        topics: [[transferSym, "*", "*", "*"]],
      },
    ],
    limit: 200,
  };
  console.log("getEvents from ledger", startLedger, "on SAC", USDC_SAC);

  let match = null;
  let cursor;
  for (let page = 0; page < 10 && !match; page++) {
    const q = cursor ? { ...params, cursor, startLedger: undefined } : params;
    const resp = await server.getEvents(q);
    const evts = resp.events || [];
    for (const e of evts) {
      if (e.txHash === txHash) { match = e; break; }
    }
    cursor = resp.cursor;
    if (!cursor || (resp.events || []).length === 0) break;
  }

  if (!match) {
    console.error("\nNo transfer event found for this tx hash in the scanned range.");
    console.error("Check: is USDC_TESTNET_SAC correct? did settlement actually transfer USDC?");
    process.exit(3);
  }

  // 3) decode topics: [ "transfer", from, to, asset ], data = amount (i128)
  const topics = match.topic.map(nativeTopic);
  const amount = nativeTopic(match.value);
  const [evName, from, to, asset] = topics;

  console.log("\n================= RAW EVENT JSON =================");
  console.log(JSON.stringify(match, null, 2));
  console.log("\n================= DECODED =================");
  console.log("event       :", evName);
  console.log("from        :", from);
  console.log("to          :", to);
  console.log("asset       :", asset);
  console.log("amount      :", String(amount), "(7-decimal USDC base units)");
  console.log("\nAGENT (payer)      :", AGENT);
  console.log("facilitator (source):", facilitator);
  console.log("fee_account (sponsor):", feeAccount || "(none / not a fee-bump)");

  // 4) verdict
  const pass = from === AGENT;
  const fromIsFacilitator = from === facilitator || from === feeAccount;
  console.log("\n================= GATE 1 VERDICT =================");
  if (pass) {
    console.log("PASS — transfer.from == AGENT. Distinct-payer Sybil counting is valid.");
  } else if (fromIsFacilitator) {
    console.log("FAIL — transfer.from == FACILITATOR. Anti-Sybil payer counting would be wrong.");
  } else {
    console.log("FAIL — transfer.from is neither AGENT nor facilitator:", from);
  }
  console.log("=================================================");

  fs.writeFileSync(
    "gate1-result.json",
    JSON.stringify({ txHash, ledger, event: evName, from, to, asset, amount: String(amount), AGENT, facilitator, feeAccount, verdict: pass ? "PASS" : "FAIL" }, null, 2)
  );
}

main().catch((e) => {
  console.error("\nGATE 1 ERROR:", e?.message || e);
  process.exit(1);
});
