// Phase 4b setup — create a lender + agent testnet account, XLM-fund them via
// friendbot, and establish the USDC classic trustline on each (required before
// they can hold/receive the real USDC the vault settles in). Saves the keypairs
// to /tmp/_phase4b_keys.json for the flow script. Testnet-only throwaway keys.

import fs from "node:fs";
import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
  BASE_FEE,
} from "@stellar/stellar-sdk";

const HORIZON = "https://horizon-testnet.stellar.org";
const server = new Horizon.Server(HORIZON);
const USDC = new Asset(
  "USDC",
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
);

async function friendbot(addr) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`https://friendbot.stellar.org/?addr=${addr}`);
    if (r.ok) return;
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error(`friendbot failed for ${addr}`);
}

async function addTrustline(kp) {
  const acct = await server.loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(acct, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  const res = await server.submitTransaction(tx);
  return res.hash;
}

const lender = Keypair.random();
const agent = Keypair.random();

console.log("funding (friendbot)…");
await friendbot(lender.publicKey());
await friendbot(agent.publicKey());

console.log("establishing USDC trustlines…");
const lt = await addTrustline(lender);
const at = await addTrustline(agent);

fs.writeFileSync(
  "/tmp/_phase4b_keys.json",
  JSON.stringify(
    {
      lender: lender.secret(),
      lenderPub: lender.publicKey(),
      agent: agent.secret(),
      agentPub: agent.publicKey(),
    },
    null,
    2,
  ),
);

console.log("\n=== accounts ready ===");
console.log("LENDER :", lender.publicKey(), "(trustline tx", lt + ")");
console.log("AGENT  :", agent.publicKey(), "(trustline tx", at + ")");
console.log("\n>>> FUND THIS LENDER ADDRESS WITH ~20 TESTNET USDC <<<");
console.log(">>> ", lender.publicKey());
