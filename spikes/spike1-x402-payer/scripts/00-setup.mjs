// Spike 1 setup: generate AGENT (payer) + SERVICE (payee) testnet keypairs,
// fund both via friendbot, add a USDC trustline to both, persist keys to ../.env.
// TESTNET ONLY. Idempotent: re-running reuses existing keys and skips done steps.
import "../load-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Keypair, Horizon, Networks, TransactionBuilder, Operation, Asset, BASE_FEE,
} from "@stellar/stellar-sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "../../.env"); // spikes/.env

const HORIZON_URL = process.env.HORIZON_URL || "https://horizon-testnet.stellar.org";
const USDC_ISSUER = process.env.USDC_TESTNET_ISSUER || "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const horizon = new Horizon.Server(HORIZON_URL);
const USDC = new Asset("USDC", USDC_ISSUER);

const last4 = (s) => (s ? s.slice(-4) : "(empty)");

function upsertEnv(updates) {
  let txt = fs.readFileSync(ENV_PATH, "utf8");
  for (const [k, v] of Object.entries(updates)) {
    const re = new RegExp(`^${k}=.*$`, "m");
    if (re.test(txt)) txt = txt.replace(re, `${k}=${v}`);
    else txt += `\n${k}=${v}`;
  }
  fs.writeFileSync(ENV_PATH, txt);
}

async function ensureFunded(kp) {
  try {
    await horizon.loadAccount(kp.publicKey());
    return "already-funded";
  } catch {
    const r = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
    if (!r.ok) throw new Error(`friendbot failed for ${kp.publicKey()}: ${r.status} ${await r.text()}`);
    return "funded-now";
  }
}

async function ensureTrustline(kp) {
  const acc = await horizon.loadAccount(kp.publicKey());
  const has = acc.balances.some(
    (b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER
  );
  if (has) return "already-trusts";
  const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  await horizon.submitTransaction(tx);
  return "trustline-added";
}

async function usdcBalance(pub) {
  try {
    const acc = await horizon.loadAccount(pub);
    const b = acc.balances.find((x) => x.asset_code === "USDC" && x.asset_issuer === USDC_ISSUER);
    return b ? b.balance : "0 (trustline present)";
  } catch { return "no-account"; }
}

async function main() {
  // Reuse keys if already in .env, else generate.
  const agent = process.env.AGENT_SECRET ? Keypair.fromSecret(process.env.AGENT_SECRET) : Keypair.random();
  const service = process.env.SERVICE_SECRET ? Keypair.fromSecret(process.env.SERVICE_SECRET) : Keypair.random();

  upsertEnv({
    AGENT_SECRET: agent.secret(),
    AGENT_PUBLIC: agent.publicKey(),
    SERVICE_SECRET: service.secret(),
    SERVICE_PUBLIC: service.publicKey(),
  });

  console.log("Keypairs (persisted to spikes/.env):");
  console.log(`  AGENT   pub=${agent.publicKey()}  sec=...${last4(agent.secret())}`);
  console.log(`  SERVICE pub=${service.publicKey()}  sec=...${last4(service.secret())}`);

  console.log("\nFunding via friendbot...");
  console.log("  AGENT  :", await ensureFunded(agent));
  console.log("  SERVICE:", await ensureFunded(service));

  // small settle delay
  await new Promise((r) => setTimeout(r, 1500));

  console.log("\nUSDC trustlines...");
  console.log("  AGENT  :", await ensureTrustline(agent));
  console.log("  SERVICE:", await ensureTrustline(service));

  console.log("\nUSDC balances:");
  console.log("  AGENT  :", await usdcBalance(agent.publicKey()));
  console.log("  SERVICE:", await usdcBalance(service.publicKey()));

  console.log("\n================ MANUAL STEPS (cannot be scripted) ================");
  console.log("1) Fund the AGENT with TESTNET USDC (Circle faucet, Captcha):");
  console.log("   https://faucet.circle.com  -> select 'Stellar testnet' -> paste:");
  console.log(`   ${agent.publicKey()}`);
  console.log("2) Generate an OZ Channels TESTNET API key (web form):");
  console.log("   https://channels.openzeppelin.com/testnet/gen");
  console.log("   -> paste into OZ_API_KEY in spikes/.env");
  console.log("==================================================================");
}

main().catch((e) => {
  console.error("\nSETUP ERROR:", e?.response?.data ? JSON.stringify(e.response.data) : e.message);
  process.exit(1);
});
