// Create customer2 + customer3, fund them from customer1's existing balance
// (no new faucet trip needed). These are independent of Scout — they trace
// back to customer1, not to Scout, so the independence check treats them as
// genuine distinct counterparties.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  Keypair, Horizon, TransactionBuilder, Operation, Asset, Networks, BASE_FEE,
} from "@stellar/stellar-sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, ".env");
dotenv.config({ path: envPath });

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");

async function friendbot(pub) {
  for (let i = 0; i < 6; i++) {
    if ((await fetch(`https://friendbot.stellar.org/?addr=${pub}`)).ok) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`friendbot failed for ${pub}`);
}

async function newFundedCustomer(label, fromKp, usdcAmount) {
  const kp = Keypair.random();
  await friendbot(kp.publicKey());
  const acct = await horizon.loadAccount(kp.publicKey());
  const trustTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(60)
    .build();
  trustTx.sign(kp);
  await horizon.submitTransaction(trustTx);

  const fromAcct = await horizon.loadAccount(fromKp.publicKey());
  const payTx = new TransactionBuilder(fromAcct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: kp.publicKey(), asset: USDC, amount: usdcAmount.toFixed(7) }))
    .setTimeout(60)
    .build();
  payTx.sign(fromKp);
  await horizon.submitTransaction(payTx);

  console.log(`  + ${label}: ${kp.publicKey()} (funded with ${usdcAmount} USDC from customer1)`);
  return kp;
}

const customer1 = Keypair.fromSecret(process.env.CUSTOMER1_SECRET);
const customer2 = await newFundedCustomer("customer2", customer1, 5);
const customer3 = await newFundedCustomer("customer3", customer1, 5);

let env = fs.readFileSync(envPath, "utf8");
if (env.length && !env.endsWith("\n")) env += "\n";
env += `CUSTOMER2_SECRET=${customer2.secret()}\n`;
env += `CUSTOMER2_PUBLIC=${customer2.publicKey()}\n`;
env += `CUSTOMER3_SECRET=${customer3.secret()}\n`;
env += `CUSTOMER3_PUBLIC=${customer3.publicKey()}\n`;
fs.writeFileSync(envPath, env);
console.log("\nSaved to agents/.env");
