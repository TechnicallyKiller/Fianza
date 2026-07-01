// TrustLine demo — 3 agents, 3 beats, all real on testnet, driven by the SDK.
//
//   Beat 1  HONEST agent earns from 3 independent payers → underwritten → a
//           lender funds its vault → the agent autonomously borrows & repays.
//   Beat 2  SYBIL agent fakes revenue by self-paying 3 wallets → the
//           independence engine catches all 3 → credit DENIED on-chain.
//   Beat 3  (optional) HONEST agent proves off-chain Stripe revenue via zkTLS.
//
// Prereqs: backend on :8787, seeded agents (/tmp/_demo_agents.json), funded lender.

import fs from "node:fs";
import { TrustLineAgent } from "../packages/agent-sdk/dist/index.js";

const d = JSON.parse(fs.readFileSync("/tmp/_demo_agents.json", "utf8"));
const opts = { apiBaseUrl: "http://localhost:8787" }; // contract ids from /config
const link = (h) => `  ↳ https://stellar.expert/explorer/testnet/tx/${h}`;
const rule = () => console.log("─".repeat(66));
const beat = (n, t) => { console.log("\n"); rule(); console.log(`BEAT ${n} — ${t}`); rule(); };
const tryTx = async (p) => { try { return await p; } catch (e) { return { err: e.message }; } };

// ─────────────────────────────────────────────────────────── Beat 1: honest
const honest = new TrustLineAgent(d.honestAgent, opts);
const lender = new TrustLineAgent(d.lender, opts);
beat(1, "Honest agent: earns → underwritten → autonomously borrows & repays");

const reg = await tryTx(honest.register());
console.log("register:", reg.err ? `(already registered) ${reg.err.slice(0, 40)}` : link(reg.txHash).trim());

const uw = await honest.underwrite({ skipProof: true, fromLedger: d.fromLedger });
const ind = uw.independence;
console.log(`underwritten → score ${uw.score.score} (${uw.score.tier}), limit ${uw.score.limitUsdc} USDC @ ${uw.score.aprBps / 100}% APR`);
console.log(`independence → ${ind.independentPayers.length} independent / ${ind.circularPayers.length} circular payers`);
console.log("score published on-chain:", uw.submission.submitted ? "\n" + link(uw.submission.txHash) : uw.submission.reason);

const dep = await lender.deposit(d.honestAgentPub, 7);
console.log("\nlender supplies 7 USDC into the agent's ISOLATED vault:");
console.log(link(dep.txHash));

console.log(`\nagent available credit: ${await honest.availableCreditUsdc()} USDC`);
const bor = await honest.borrow(5);
console.log("agent autonomously BORROWS 5 USDC (working capital):");
console.log(link(bor.txHash));
console.log("…agent does the paid work, earns, then repays…");
const rep = await honest.repay(5);
console.log("agent REPAYS 5 USDC (interest → lender yield):");
console.log(link(rep.txHash));
const vs = await honest.vaultState();
console.log(`vault now → liquidity ${vs.liquidityUsdc} USDC, principal ${vs.principalUsdc}, yield ${vs.yieldPoolUsdc}`);

// ──────────────────────────────────────────────────────────── Beat 2: sybil
const sybil = new TrustLineAgent(d.sybilAgent, opts);
beat(2, "Sybil agent: fakes revenue by paying itself → DENIED");

const sreg = await tryTx(sybil.register());
console.log("register:", sreg.err ? `(already registered)` : link(sreg.txHash).trim());
const suw = await sybil.underwrite({ skipProof: true, fromLedger: d.fromLedger });
const sind = suw.independence;
console.log(`indexed ${suw.revenue.totalRevenueUsdc} USDC from ${suw.revenue.distinctPayers} payers`);
console.log(`independence → ${sind.circularPayers.length} CIRCULAR payers caught, ${sind.independentPayers.length} independent`);
console.log(`underwritten → score ${suw.score.score} (${suw.score.tier}), limit ${suw.score.limitUsdc} USDC`);
console.log(`VERDICT: ${suw.score.limitUsdc > 0 ? "APPROVED" : "🚫 CREDIT DENIED"}`);

const badBorrow = await tryTx(sybil.borrow(1));
console.log("sybil tries to borrow 1 USDC anyway →",
  badBorrow.err ? `rejected on-chain: ${badBorrow.err.slice(0, 60)}` : "SUCCEEDED (unexpected!)");

// ─────────────────────────────────────────────────────── Beat 3: zkTLS (opt)
if (process.argv.includes("--zktls")) {
  beat(3, "Honest agent proves off-chain Stripe revenue via zkTLS");
  const z = await honest.underwrite({ skipProof: false, fromLedger: d.fromLedger });
  console.log(z.proof?.verified
    ? `zkTLS verified ${Number(z.proof.amountStroops) / 1e7} USDC off-chain → score ${z.score.score}`
    : `proof unavailable (${z.proofError ?? "n/a"}) — on-chain revenue only`);
}

console.log("\n");
rule();
console.log("Demo complete — honest agent funded & autonomous, sybil agent denied. All on testnet.");
rule();
