// Create the demo lender account: XLM-funded + USDC trustline. Faucet USDC to it,
// then it deposits into the honest agent's isolated vault in the demo.
import fs from "node:fs";
import { Keypair, Horizon, TransactionBuilder, Operation, Asset, Networks, BASE_FEE } from "@stellar/stellar-sdk";

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");

async function friendbot(a) { for (let i=0;i<6;i++){ if((await fetch(`https://friendbot.stellar.org/?addr=${a}`)).ok) return; await new Promise(r=>setTimeout(r,2000)); } throw new Error("friendbot"); }

const lender = Keypair.random();
await friendbot(lender.publicKey());
const acct = await horizon.loadAccount(lender.publicKey());
const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.changeTrust({ asset: USDC })).setTimeout(60).build();
tx.sign(lender);
await horizon.submitTransaction(tx);

const demo = JSON.parse(fs.readFileSync("/tmp/_demo_agents.json", "utf8"));
demo.lender = lender.secret();
demo.lenderPub = lender.publicKey();
fs.writeFileSync("/tmp/_demo_agents.json", JSON.stringify(demo, null, 2));

console.log("lender ready (XLM + USDC trustline).");
console.log("\n>>> FAUCET ~20 TESTNET USDC TO THE LENDER <<<");
console.log(">>> ", lender.publicKey());
