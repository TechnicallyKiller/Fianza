// Seed real, on-chain demo revenue for the 3-agent / 3-beat demo.
//
//  HONEST agent  ← paid by 3 INDEPENDENT payers (funded by the funder, not the
//                  agent) → independence engine counts it → funded credit line.
//  SYBIL  agent  ← paid by 3 wallets the agent itself funded → fund-flow loop →
//                  revenue excluded → Unrated → credit DENIED.
//
// Every transfer goes through the USDC SAC (Soroban invoke), so they appear both
// in the revenue indexer and in the independence engine's transfer graph.

import fs from "node:fs";
import {
  rpc, Horizon, Contract, Address, TransactionBuilder, nativeToScVal,
  Operation, Asset, Keypair, Networks, BASE_FEE, TimeoutInfinite,
} from "@stellar/stellar-sdk";

const RPC = "https://soroban-testnet.stellar.org";
const PASS = Networks.TESTNET;
const USDC_SAC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");

const server = new rpc.Server(RPC);
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const funder = Keypair.fromSecret(JSON.parse(fs.readFileSync("/tmp/_seed_funder.json", "utf8")).funder);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function friendbot(pub) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`https://friendbot.stellar.org/?addr=${pub}`);
    if (r.ok) return;
    await sleep(2000);
  }
  throw new Error(`friendbot failed: ${pub}`);
}

// New account: XLM-funded + USDC trustline.
async function newAccount(label) {
  const kp = Keypair.random();
  await friendbot(kp.publicKey());
  const acct = await horizon.loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: PASS })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(60).build();
  tx.sign(kp);
  await horizon.submitTransaction(tx);
  console.log(`  + ${label}: ${kp.publicKey()}`);
  return kp;
}

// USDC transfer through the SAC (Soroban), signed by `fromKp`.
async function pay(fromKp, toPub, usdc) {
  const stroops = BigInt(Math.round(usdc * 1e7));
  const acct = await server.getAccount(fromKp.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: PASS })
    .addOperation(new Contract(USDC_SAC).call(
      "transfer",
      new Address(fromKp.publicKey()).toScVal(),
      new Address(toPub).toScVal(),
      nativeToScVal(stroops, { type: "i128" }),
    ))
    .setTimeout(TimeoutInfinite).build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(fromKp);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") throw new Error(`transfer ERROR: ${JSON.stringify(sent.errorResult)}`);
  let g = await server.getTransaction(sent.hash);
  for (let i = 0; i < 40 && g.status === "NOT_FOUND"; i++) { await sleep(1000); g = await server.getTransaction(sent.hash); }
  if (g.status !== "SUCCESS") throw new Error(`transfer ${sent.hash} → ${g.status}`);
  return sent.hash;
}

const fromLedger = (await server.getLatestLedger()).sequence;
console.log(`seeding from ledger ${fromLedger}\n`);

console.log("creating accounts…");
const honestAgent = await newAccount("honestAgent");
const honestPayers = [await newAccount("payer1"), await newAccount("payer2"), await newAccount("payer3")];
const sybilAgent = await newAccount("sybilAgent");
const sybilWallets = [await newAccount("sybil1"), await newAccount("sybil2"), await newAccount("sybil3")];

console.log("\nfunder → 3 independent payers (2.6 USDC each)…");
for (const p of honestPayers) await pay(funder, p.publicKey(), 2.6);

console.log("funder → sybil agent (7 USDC, so it can fund its own wallets)…");
await pay(funder, sybilAgent.publicKey(), 7);

console.log("\nHONEST: 3 independent payers → honest agent (2.5 USDC each)…");
for (const p of honestPayers) await pay(p, honestAgent.publicKey(), 2.5);

console.log("SYBIL: agent funds its own 3 wallets (2.2 each)…");
for (const w of sybilWallets) await pay(sybilAgent, w.publicKey(), 2.2);
console.log("SYBIL: those wallets 'pay' the agent back (2.0 each) — the loop…");
for (const w of sybilWallets) await pay(w, sybilAgent.publicKey(), 2.0);

const out = {
  fromLedger,
  honestAgent: honestAgent.secret(), honestAgentPub: honestAgent.publicKey(),
  honestPayers: honestPayers.map((k) => k.publicKey()),
  sybilAgent: sybilAgent.secret(), sybilAgentPub: sybilAgent.publicKey(),
  sybilWallets: sybilWallets.map((k) => k.publicKey()),
};
fs.writeFileSync("/tmp/_demo_agents.json", JSON.stringify(out, null, 2));

console.log("\n=== seeded ===");
console.log("HONEST agent:", honestAgent.publicKey());
console.log("SYBIL  agent:", sybilAgent.publicKey());
console.log("fromLedger:", fromLedger, "→ saved /tmp/_demo_agents.json");
