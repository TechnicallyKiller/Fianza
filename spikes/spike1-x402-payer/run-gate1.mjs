// One-shot Gate 1 runner: preflight -> start server -> one paid request -> decode event.
// Run AFTER you've put OZ_API_KEY in spikes/.env and funded AGENT with testnet USDC.
//   node run-gate1.mjs
import "./load-env.mjs";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Horizon } from "@stellar/stellar-sdk";

// Cold CJS imports over the UNC filesystem are slow (~20s). Cache compiled bytecode
// so repeat runs are faster, and give every step a generous timeout.
const COMPILE_CACHE = path.join(os.tmpdir(), "trustline-node-cache");
const childEnv = { ...process.env, NODE_COMPILE_CACHE: COMPILE_CACHE };

const HORIZON_URL = process.env.HORIZON_URL || "https://horizon-testnet.stellar.org";
const ISSUER = process.env.USDC_TESTNET_ISSUER;

function sh(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: "inherit", shell: false, env: childEnv });
    p.on("exit", (code) => resolve(code ?? 1));
  });
}

async function agentUsdc() {
  try {
    const acc = await new Horizon.Server(HORIZON_URL).loadAccount(process.env.AGENT_PUBLIC);
    const b = acc.balances.find((x) => x.asset_code === "USDC" && x.asset_issuer === ISSUER);
    return b ? Number(b.balance) : 0;
  } catch { return -1; }
}

// --- preflight ---
const problems = [];
if (!process.env.OZ_API_KEY) problems.push("OZ_API_KEY missing (https://channels.openzeppelin.com/testnet/gen)");
const bal = await agentUsdc();
if (bal <= 0) problems.push(`AGENT has no testnet USDC (balance=${bal}); fund at https://faucet.circle.com -> ${process.env.AGENT_PUBLIC}`);
if (problems.length) {
  console.error("PREFLIGHT FAILED — Gate 1 cannot run yet:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`Preflight OK. AGENT USDC balance: ${bal}\n`);

// --- start server ---
// Readiness is detected via the synchronous boot.log "LISTENING" marker, because
// piped stdout is block-buffered on Windows and unreliable.
try { fs.unlinkSync("boot.log"); } catch {}
const server = spawn("node", ["server.js"], { stdio: ["ignore", "inherit", "inherit"], env: childEnv });
const READY_MS = 90000;
let ready = false;
const t0 = Date.now();
process.stdout.write("waiting for server to boot (cold UNC import can take ~25s)...\n");
while (!ready && Date.now() - t0 < READY_MS) {
  await new Promise((r) => setTimeout(r, 500));
  try {
    if (fs.readFileSync("boot.log", "utf8").includes("LISTENING")) ready = true;
  } catch {}
  if (server.exitCode !== null) break;
}
if (!ready) {
  console.error(`server did not become ready in ${READY_MS}ms. boot.log:`);
  try { console.error(fs.readFileSync("boot.log", "utf8")); } catch { console.error("(no boot.log)"); }
  server.kill();
  process.exit(1);
}
console.log(`server ready after ${Date.now() - t0}ms`);

try {
  console.log("\n--- making EXACTLY ONE paid request ---");
  const c = await sh("node", ["client.js"]);
  if (c !== 0) { console.error("client.js exited", c); process.exit(c); }
  // give RPC a moment to index the settlement tx
  await new Promise((r) => setTimeout(r, 6000));
  console.log("\n--- GATE 1 evidence ---");
  const g = await sh("node", ["gate1-payer-check.mjs"]);
  process.exitCode = g;
} finally {
  server.kill();
}
