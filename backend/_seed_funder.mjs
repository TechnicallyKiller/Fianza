// Create the seeder funder account: XLM-funded (friendbot) + USDC trustline.
// You then faucet ~20 USDC to it; the seeder uses it to fund the demo's payer
// wallets and orchestrate real revenue. Testnet-only throwaway key.

import fs from "node:fs";
import {
  Keypair, Horizon, TransactionBuilder, Operation, Asset, Networks, BASE_FEE,
} from "@stellar/stellar-sdk";

const server = new Horizon.Server("https://horizon-testnet.stellar.org");
const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");

async function friendbot(addr) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`https://friendbot.stellar.org/?addr=${addr}`);
    if (r.ok) return;
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error(`friendbot failed for ${addr}`);
}

const funder = Keypair.random();
console.log("funding funder via friendbot…");
await friendbot(funder.publicKey());

const acct = await server.loadAccount(funder.publicKey());
const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.changeTrust({ asset: USDC }))
  .setTimeout(60).build();
tx.sign(funder);
const res = await server.submitTransaction(tx);

fs.writeFileSync("/tmp/_seed_funder.json", JSON.stringify({
  funder: funder.secret(), funderPub: funder.publicKey(),
}, null, 2));

console.log("\n=== funder ready (XLM + USDC trustline tx " + res.hash + ") ===");
console.log("\n>>> FAUCET ~20 TESTNET USDC TO THIS ADDRESS <<<");
console.log(">>> ", funder.publicKey());
