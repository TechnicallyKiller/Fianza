import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair, Horizon, TransactionBuilder, Operation, Asset, Networks, BASE_FEE } from "@stellar/stellar-sdk";

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, ".env");

async function friendbot(pub) {
  for (let i = 0; i < 6; i++) {
    if ((await fetch(`https://friendbot.stellar.org/?addr=${pub}`)).ok) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`friendbot failed for ${pub}`);
}

async function newAgentWallet(label) {
  const kp = Keypair.random();
  await friendbot(kp.publicKey());
  const acct = await horizon.loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  await horizon.submitTransaction(tx);
  console.log(`  + ${label}: ${kp.publicKey()}`);
  return kp;
}

const analyst = await newAgentWallet("analyst");
const reviewer = await newAgentWallet("reviewer");

let env = fs.readFileSync(envPath, "utf8");
if (env.length && !env.endsWith("\n")) env += "\n";
const set = (k, v) => {
  if (new RegExp(`^${k}=`, "m").test(env)) env = env.replace(new RegExp(`^${k}=.*`, "m"), `${k}=${v}`);
  else env += `${k}=${v}\n`;
};
set("ANALYST_WALLET_SECRET", analyst.secret());
set("ANALYST_WALLET_PUBLIC", analyst.publicKey());
set("REVIEWER_WALLET_SECRET", reviewer.secret());
set("REVIEWER_WALLET_PUBLIC", reviewer.publicKey());
fs.writeFileSync(envPath, env);
console.log("saved to agents/.env");
