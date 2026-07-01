// Phase 4b flow — the full on-chain credit loop on testnet, reporting every tx
// hash. Auth model: each call is sourced+signed by the address whose require_auth
// it needs (agent for register/borrow/repay, lender for deposit, signer for
// publish_score/record_repayment), so no extra auth entries are required.
//
// NOTE: the published score uses a representative revenue figure to exercise the
// credit mechanics — real indexed testnet revenue is ~0 (see PROJECT_LOG).

import fs from "node:fs";
import dotenv from "dotenv";
import {
  rpc,
  Contract,
  Address,
  TransactionBuilder,
  nativeToScVal,
  Keypair,
  Horizon,
  Asset,
  Networks,
  BASE_FEE,
} from "@stellar/stellar-sdk";

dotenv.config({ path: ".env" });

const REGISTRY = "CAZUPW5MWHG5XCE7BM6YP6M52NPB6TPRRAXU3GEV4TL2AR2ZMYE7TRSX";
const VAULT = "CD5RQFFYF57MLI3JI2PHUROMYFWLGDB7RPMGIK5JRWAO6NWHEUE3EC6C";
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const STROOPS = 10_000_000n;
const DEPOSIT = 10n * STROOPS; // lender supplies 10 USDC
const BORROW = 5n * STROOPS; //  agent draws 5 USDC
const REPAY = 5n * STROOPS; //   agent repays 5 USDC
const SCORE = 720; //            representative Tier-B score
const REVENUE = 25n * STROOPS; // representative trailing revenue -> 50 USDC limit (2x)

const server = new rpc.Server("https://soroban-testnet.stellar.org");
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const k = JSON.parse(fs.readFileSync("/tmp/_phase4b_keys.json", "utf8"));
const lender = Keypair.fromSecret(k.lender);
const agent = Keypair.fromSecret(k.agent);
const signer = Keypair.fromSecret(process.env.SCORE_SIGNER_SECRET);

const addr = (a) => new Address(a).toScVal();
const i128 = (n) => nativeToScVal(n, { type: "i128" });
const u32 = (n) => nativeToScVal(n, { type: "u32" });
const bool = (b) => nativeToScVal(b, { type: "bool" });

async function invoke(label, contractId, method, args, source) {
  const acct = await server.getAccount(source.publicKey());
  const tx = new TransactionBuilder(acct, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(60)
    .build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(source);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR")
    throw new Error(`${label}: ${JSON.stringify(sent.errorResult)}`);
  let g = await server.getTransaction(sent.hash);
  for (let i = 0; i < 40 && g.status === "NOT_FOUND"; i++) {
    await sleep(1000);
    g = await server.getTransaction(sent.hash);
  }
  if (g.status !== "SUCCESS") throw new Error(`${label} -> ${g.status}`);
  console.log(`✅ ${label}\n   tx ${sent.hash}`);
  return sent.hash;
}

async function usdcBalance(pub) {
  const a = await horizon.loadAccount(pub);
  const line = a.balances.find(
    (b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER,
  );
  return line ? Number(line.balance) : 0;
}

// Preflight: the lender must already hold USDC from the faucet.
const bal = await usdcBalance(lender.publicKey());
console.log(`lender USDC balance: ${bal}`);
if (bal < Number(DEPOSIT) / 1e7) {
  console.error(
    `\n✗ Lender has ${bal} USDC but needs >= ${Number(DEPOSIT) / 1e7}. ` +
      `Fund ${lender.publicKey()} via faucet.circle.com (Stellar testnet) and re-run.`,
  );
  process.exit(1);
}

console.log("\n=== TrustLine full on-chain flow (testnet) ===\n");
await invoke("1. register (agent)", REGISTRY, "register", [addr(agent.publicKey())], agent);
await invoke("2. publish_score (signer)", REGISTRY, "publish_score", [addr(agent.publicKey()), u32(SCORE), i128(REVENUE)], signer);
await invoke("3. deposit 10 USDC (lender)", VAULT, "deposit", [addr(lender.publicKey()), addr(agent.publicKey()), i128(DEPOSIT)], lender);
await invoke("4. borrow 5 USDC (agent)", VAULT, "borrow", [addr(agent.publicKey()), i128(BORROW)], agent);
await invoke("5. repay 5 USDC (agent)", VAULT, "repay", [addr(agent.publicKey()), i128(REPAY)], agent);
await invoke("6. record_repayment (signer)", REGISTRY, "record_repayment", [addr(agent.publicKey()), bool(true)], signer);

console.log("\n=== final balances ===");
console.log(`lender USDC: ${await usdcBalance(lender.publicKey())}`);
console.log(`agent  USDC: ${await usdcBalance(agent.publicKey())}`);
console.log("\nDone — all six steps settled on testnet.");
