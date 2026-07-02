// Keep-alive: pays a real, small job to a random agent from a random existing
// customer wallet, so Analyst/Reviewer/Scout stay earning and don't go stale.
//
// IMPORTANT — scope: this only triggers RESEARCH/REVIEW jobs (read-only
// analysis). It never places a trade or moves funds based on an agent's own
// decision; it just keeps paid demand flowing so the agents have real,
// current revenue. It does NOT create organic external demand — it's
// scheduled traffic from wallets we control, which is honest (real payments,
// real settlement, real LLM calls) but not a substitute for real users.
//
// Runs ONE tick per invocation (cron-friendly — schedule this with Render
// Cron Jobs, a plain crontab, or `node keep-alive.mjs --loop` for local dev).
//
// Usage:
//   node keep-alive.mjs            # one tick, exits
//   node keep-alive.mjs --loop     # local dev: tick every INTERVAL_MINS
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env") });

import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const NETWORK = "stellar:testnet";
const INTERVAL_MINS = Number(process.env.KEEPALIVE_INTERVAL_MINS || 30);

const CUSTOMERS = ["CUSTOMER1_SECRET", "CUSTOMER2_SECRET", "CUSTOMER3_SECRET"];

const JOBS = [
  {
    url: process.env.ANALYST_URL || "http://127.0.0.1:3022/research",
    body: () => ({
      asset: pick([
        "gold", "the S&P 500", "Bitcoin", "the US dollar index", "crude oil",
        "10-year Treasury yields", "the Euro", "silver", "the Nasdaq 100",
      ]),
    }),
  },
  {
    url: process.env.REVIEWER_URL || "http://127.0.0.1:3023/review",
    body: () =>
      pick([
        { code: "function add(a,b){return a+b}", language: "javascript" },
        { code: "def div(a,b): return a/b", language: "python" },
        { code: "SELECT * FROM users WHERE id = " + "input", language: "sql" },
        { code: "let x = 5; if (x = 6) { console.log('never'); }", language: "javascript" },
      ]),
  },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function tick() {
  const job = pick(JOBS);
  const custVar = pick(CUSTOMERS);
  const secret = process.env[custVar];
  if (!secret) {
    console.log(`[keep-alive] skip: ${custVar} not set`);
    return;
  }
  const signer = createEd25519Signer(secret, NETWORK);
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: NETWORK, client: new ExactStellarScheme(signer) }],
  });
  const body = JSON.stringify(job.body());
  console.log(`[keep-alive] ${custVar} -> ${job.url}  ${body}`);
  try {
    const res = await fetchWithPayment(job.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    console.log(`[keep-alive] HTTP ${res.status}`);
  } catch (e) {
    console.error(`[keep-alive] job failed:`, e.message);
  }
}

const loop = process.argv.includes("--loop");
if (loop) {
  console.log(`[keep-alive] looping every ${INTERVAL_MINS}min (local dev mode)`);
  tick();
  setInterval(tick, INTERVAL_MINS * 60_000);
} else {
  await tick();
}
