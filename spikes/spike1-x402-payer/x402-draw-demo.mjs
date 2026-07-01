// ✨ Draw-on-402: the agent hits a paywall it can't afford, auto-draws the
// shortfall from its TrustLine credit line, and pays — over x402. Credit made
// invisible. The agent never "decides to borrow"; it just transacts.
import "./load-env.mjs";
import fs from "node:fs";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import {
  rpc, Horizon, Contract, Address, TransactionBuilder, nativeToScVal, Keypair, Networks, BASE_FEE, TimeoutInfinite,
} from "@stellar/stellar-sdk";
import { TrustLineAgent } from "../../packages/agent-sdk/dist/index.js";

const NETWORK = "stellar:testnet";
const URL = "http://127.0.0.1:3010/premium";
const PRICE_USDC = Number(process.env.PRICE_USDC || "3");
const USDC_SAC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const d = JSON.parse(fs.readFileSync("/tmp/_demo_agents.json", "utf8"));
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const server = new rpc.Server("https://soroban-testnet.stellar.org");
const link = (h) => `https://stellar.expert/explorer/testnet/tx/${h}`;

async function usdc(pub) {
  const a = await horizon.loadAccount(pub);
  const b = a.balances.find((x) => x.asset_code === "USDC");
  return b ? Number(b.balance) : 0;
}
// Raw SAC transfer (used only to drain the agent's cash for the demo setup).
async function sacTransfer(fromKp, toPub, amount) {
  const acct = await server.getAccount(fromKp.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(USDC_SAC).call("transfer",
      new Address(fromKp.publicKey()).toScVal(), new Address(toPub).toScVal(),
      nativeToScVal(BigInt(Math.round(amount * 1e7)), { type: "i128" })))
    .setTimeout(TimeoutInfinite).build();
  const p = await server.prepareTransaction(tx); p.sign(fromKp);
  const s = await server.sendTransaction(p);
  let g = await server.getTransaction(s.hash);
  for (let i = 0; i < 40 && g.status === "NOT_FOUND"; i++) { await new Promise(r => setTimeout(r, 1000)); g = await server.getTransaction(s.hash); }
}

const agent = new TrustLineAgent(d.honestAgent, { apiBaseUrl: "http://localhost:8787" });
const kp = Keypair.fromSecret(d.honestAgent);
const pub = agent.publicKey();

// --- setup: make the agent cash-poor so the paywall bites ---
let bal = await usdc(pub);
if (bal > 1) {
  console.log(`(demo setup: agent has ${bal} USDC — draining to ~0.5 so the paywall bites)`);
  await sacTransfer(kp, JSON.parse(fs.readFileSync("/tmp/_seed_funder.json", "utf8")).funderPub ?? d.honestAgentPub, bal - 0.5);
}

console.log(`\n🤖 agent wants a $${PRICE_USDC} premium API call.`);
bal = await usdc(pub);
const avail = await agent.availableCreditUsdc();
console.log(`   cash on hand: ${bal} USDC   |   TrustLine credit available: ${avail} USDC`);

if (bal < PRICE_USDC) {
  const need = Math.ceil((PRICE_USDC - bal) * 100) / 100;
  console.log(`   can't afford it → auto-drawing ${need} USDC from its credit line…`);
  const b = await agent.borrow(need);
  console.log(`   ↳ drew credit: ${link(b.txHash)}`);
  console.log(`   cash on hand now: ${await usdc(pub)} USDC`);
}

const signer = createEd25519Signer(d.honestAgent, NETWORK);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: NETWORK, client: new ExactStellarScheme(signer) }] });
console.log(`   paying $${PRICE_USDC} over x402…`);
const res = await fetchWithPayment(URL);
console.log(`   HTTP ${res.status} →`, JSON.stringify(await res.json().catch(() => null)));

console.log(`\n✅ The agent accessed a resource it could NOT afford — funded by its`);
console.log(`   revenue-backed credit line, settled over x402. No human. Credit, invisible.`);
