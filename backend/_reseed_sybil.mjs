// Re-seed a CLEAN sybil agent: fund it via a classic USDC payment (not a SAC
// transfer, so it isn't counted as revenue), then run the self-pay loop via SAC.
// Result: the agent's only indexed revenue is the 3 circular wallets → 0
// independent → a crystal-clear "100% fake, denied".

import fs from "node:fs";
import {
  rpc, Horizon, Contract, Address, TransactionBuilder, nativeToScVal,
  Operation, Asset, Keypair, Networks, BASE_FEE, TimeoutInfinite,
} from "@stellar/stellar-sdk";

const PASS = Networks.TESTNET;
const USDC_SAC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const server = new rpc.Server("https://soroban-testnet.stellar.org");
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const demo = JSON.parse(fs.readFileSync("/tmp/_demo_agents.json", "utf8"));
const funder = Keypair.fromSecret(JSON.parse(fs.readFileSync("/tmp/_seed_funder.json", "utf8")).funder);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function friendbot(pub) {
  for (let i = 0; i < 6; i++) { if ((await fetch(`https://friendbot.stellar.org/?addr=${pub}`)).ok) return; await sleep(2000); }
  throw new Error("friendbot failed");
}
async function newAccount(label) {
  const kp = Keypair.random();
  await friendbot(kp.publicKey());
  const acct = await horizon.loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: PASS })
    .addOperation(Operation.changeTrust({ asset: USDC })).setTimeout(60).build();
  tx.sign(kp); await horizon.submitTransaction(tx);
  console.log(`  + ${label}: ${kp.publicKey()}`);
  return kp;
}
// CLASSIC USDC payment (Horizon) — NOT a SAC transfer, so the indexer ignores it.
async function classicPay(fromKp, toPub, usdc) {
  const acct = await horizon.loadAccount(fromKp.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: PASS })
    .addOperation(Operation.payment({ destination: toPub, asset: USDC, amount: usdc.toFixed(7) }))
    .setTimeout(60).build();
  tx.sign(fromKp); await horizon.submitTransaction(tx);
}
// SAC transfer (Soroban) — indexed + graph-visible.
async function sacPay(fromKp, toPub, usdc) {
  const acct = await server.getAccount(fromKp.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: PASS })
    .addOperation(new Contract(USDC_SAC).call("transfer",
      new Address(fromKp.publicKey()).toScVal(), new Address(toPub).toScVal(),
      nativeToScVal(BigInt(Math.round(usdc * 1e7)), { type: "i128" })))
    .setTimeout(TimeoutInfinite).build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(fromKp);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") throw new Error(JSON.stringify(sent.errorResult));
  let g = await server.getTransaction(sent.hash);
  for (let i = 0; i < 40 && g.status === "NOT_FOUND"; i++) { await sleep(1000); g = await server.getTransaction(sent.hash); }
  if (g.status !== "SUCCESS") throw new Error(`${sent.hash} → ${g.status}`);
}

console.log("creating clean sybil agent + 3 wallets…");
const sybil = await newAccount("sybilClean");
const wallets = [await newAccount("w1"), await newAccount("w2"), await newAccount("w3")];

console.log("funder → sybil agent 4 USDC via CLASSIC payment (not indexed)…");
await classicPay(funder, sybil.publicKey(), 4);

console.log("sybil agent → its 3 wallets (1.2 each) via SAC (the funding edge)…");
for (const w of wallets) await sacPay(sybil, w.publicKey(), 1.2);
console.log("wallets → sybil agent (1.0 each) via SAC (the fake revenue / loop)…");
for (const w of wallets) await sacPay(w, sybil.publicKey(), 1.0);

demo.sybilAgent = sybil.secret();
demo.sybilAgentPub = sybil.publicKey();
demo.sybilWallets = wallets.map((k) => k.publicKey());
fs.writeFileSync("/tmp/_demo_agents.json", JSON.stringify(demo, null, 2));
console.log("\nclean SYBIL agent:", sybil.publicKey(), "→ updated /tmp/_demo_agents.json");
