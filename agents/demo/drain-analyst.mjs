// One-off: sweep ANALYST's spare USDC into the demo HOLDING wallet so ANALYST
// stays cash-poor (keeps its real Tier-C credit line) and MUST draw credit to
// buy the $0.30 data call in the demo. Leaves a small cash float on ANALYST.
//
// Reversible: to undo, send USDC from DEMO_HOLDING back to ANALYST_WALLET_PUBLIC.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../.env") });
// Also load the gitignored holding-wallet keys.
dotenv.config({ path: path.resolve(here, "../.demo-holding-wallet.local") });

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const FLOAT = "0.05"; // USDC left on ANALYST so it's short but not empty.

const analyst = Keypair.fromSecret(process.env.ANALYST_WALLET_SECRET);
const holdingPub = process.env.DEMO_HOLDING_PUBLIC;
const holding = Keypair.fromSecret(process.env.DEMO_HOLDING_SECRET);
if (!holdingPub) throw new Error("DEMO_HOLDING_PUBLIC missing (.demo-holding-wallet.local)");

async function friendbot(pub) {
  for (let i = 0; i < 3; i++) {
    if ((await fetch(`https://friendbot.stellar.org/?addr=${pub}`)).ok) return true;
  }
  return false;
}

async function usdcBalance(pub) {
  const acct = await horizon.loadAccount(pub);
  const b = acct.balances.find(
    (x) => x.asset_code === "USDC" && x.asset_issuer === USDC.issuer,
  );
  return b ? Number(b.balance) : null; // null = no trustline
}

// 1. Make sure the holding wallet exists + has a USDC trustline.
console.log("[drain] holding wallet:", holdingPub);
let holdingBal = await usdcBalance(holdingPub).catch(() => "no-account");
if (holdingBal === "no-account") {
  console.log("[drain] funding holding wallet via friendbot…");
  if (!(await friendbot(holdingPub))) throw new Error("friendbot failed");
  holdingBal = null;
}
if (holdingBal === null) {
  console.log("[drain] adding USDC trustline to holding wallet…");
  const acct = await horizon.loadAccount(holdingPub);
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(60)
    .build();
  tx.sign(holding);
  await horizon.submitTransaction(tx);
  console.log("[drain] trustline established.");
}

// 2. Compute how much to sweep from ANALYST (all but FLOAT).
const analystBal = await usdcBalance(analyst.publicKey());
console.log("[drain] ANALYST cash USDC:", analystBal);
const sweep = Math.floor((analystBal - Number(FLOAT)) * 1e7) / 1e7;
if (sweep <= 0) {
  console.log("[drain] nothing to sweep (already at/below float). Done.");
  process.exit(0);
}

// 3. Send it to the holding wallet.
const acct = await horizon.loadAccount(analyst.publicKey());
const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(
    Operation.payment({ destination: holdingPub, asset: USDC, amount: sweep.toFixed(7) }),
  )
  .setTimeout(60)
  .build();
tx.sign(analyst);
const r = await horizon.submitTransaction(tx);
console.log(`[drain] swept ${sweep} USDC → holding. tx: ${r.hash}`);
console.log(`[drain] https://stellar.expert/explorer/testnet/tx/${r.hash}`);
console.log("[drain] ANALYST now holds ~$" + FLOAT + " cash, keeps its credit line.");
