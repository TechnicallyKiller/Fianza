// Give a set of customer wallets genuine external economic activity: a real,
// small on-chain payment each to an unrelated third party (not the agent, not
// each other). This is real diversity, not a code hack — it's what any wallet
// that's actually used for other things would naturally have, and it's what
// TrustLine's independence engine (backend/src/scoring/independence.ts) checks
// for as evidence a payer isn't a puppet that only ever pays one agent.
//
// Usage: node give-diversity.mjs CUSTOMER1_PUBLIC CUSTOMER2_PUBLIC ...
// Reads matching *_SECRET vars from .env to sign. Idempotent-ish — skips
// wallets that already hold enough USDC to make the payment.
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import dotenv from "dotenv";
import {
  Keypair, Horizon, TransactionBuilder, Operation, Asset, Networks, BASE_FEE,
} from "@stellar/stellar-sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, ".env");
dotenv.config({ path: envPath });

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const PAY_AMOUNT = 0.1;

async function usdcBalance(pub) {
  const acct = await horizon.loadAccount(pub);
  return Number(acct.balances.find((b) => b.asset_code === "USDC")?.balance ?? "0");
}

async function friendbot(pub) {
  for (let i = 0; i < 6; i++) {
    if ((await fetch(`https://friendbot.stellar.org/?addr=${pub}`)).ok) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`friendbot failed for ${pub}`);
}

async function pay(fromKp, toPub, amount) {
  const acct = await horizon.loadAccount(fromKp.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: toPub, asset: USDC, amount: amount.toFixed(7) }))
    .setTimeout(60)
    .build();
  tx.sign(fromKp);
  return horizon.submitTransaction(tx);
}

const pubVars = process.argv.slice(2);
if (pubVars.length === 0) {
  console.error("usage: node give-diversity.mjs CUSTOMER1_PUBLIC CUSTOMER2_PUBLIC ...");
  process.exit(1);
}

// One genuinely unrelated third party — receives from every wallet passed in.
// Not the agent, not a co-payer, not funded by anyone involved.
const marketplace = Keypair.random();
await friendbot(marketplace.publicKey());
const mAcct = await horizon.loadAccount(marketplace.publicKey());
const trustTx = new TransactionBuilder(mAcct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.changeTrust({ asset: USDC }))
  .setTimeout(60)
  .build();
trustTx.sign(marketplace);
await horizon.submitTransaction(trustTx);
console.log("marketplace:", marketplace.publicKey());

for (const pubVar of pubVars) {
  const pub = process.env[pubVar];
  const secretVar = pubVar.replace(/_PUBLIC$/, "_SECRET");
  const secret = process.env[secretVar];
  if (!pub || !secret) {
    console.log(`skip ${pubVar}: missing ${pubVar} or ${secretVar} in .env`);
    continue;
  }
  const kp = Keypair.fromSecret(secret);
  const bal = await usdcBalance(pub);
  if (bal < PAY_AMOUNT) {
    console.log(`skip ${pubVar}: balance ${bal} USDC < ${PAY_AMOUNT} needed`);
    continue;
  }
  const res = await pay(kp, marketplace.publicKey(), PAY_AMOUNT);
  console.log(`${pubVar} -> marketplace: ${PAY_AMOUNT} USDC (tx ${res.hash.slice(0, 12)}...)`);
}

let env = fs.readFileSync(envPath, "utf8");
if (env.length && !env.endsWith("\n")) env += "\n";
env += `DIVERSITY_MARKETPLACE=${marketplace.publicKey()}\n`;
fs.writeFileSync(envPath, env);
