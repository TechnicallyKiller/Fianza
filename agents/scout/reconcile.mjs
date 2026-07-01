// Run periodically (manually, or via a scheduled cron hitting this script).
// Registers Scout if needed, re-underwrites it on its REAL accrued revenue
// (no fromLedger needed — the default lookback covers recent activity for a
// freshly-active agent), and repays from earnings opportunistically.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

import { TrustLineAgent } from "../../packages/agent-sdk/dist/index.js";

const tl = new TrustLineAgent(process.env.SCOUT_WALLET_SECRET, {
  apiBaseUrl: process.env.TRUSTLINE_API || "http://localhost:8787",
});
const BUFFER_USDC = Number(process.env.SCOUT_REPAY_BUFFER || "1");

async function main() {
  console.log("agent:", tl.publicKey());

  console.log("\n1. register (idempotent)...");
  try {
    const r = await tl.register();
    console.log("   →", r.txHash);
  } catch (e) {
    console.log("   skipped:", e.message.slice(0, 90));
  }

  console.log("\n2. re-underwriting on real accrued revenue...");
  const uw = await tl.underwrite({ skipProof: true });
  console.log(
    `   score ${uw.score.score} (${uw.score.tier}) — limit ${uw.score.limitUsdc} USDC @ ${uw.score.aprBps / 100}%`,
  );
  if (uw.independence) {
    console.log(
      `   independence: ${uw.independence.independentPayers.length} independent, ${uw.independence.circularPayers.length} circular`,
    );
  }
  console.log(
    `   revenue indexed: ${uw.revenue.totalRevenueUsdc} USDC from ${uw.revenue.distinctPayers} payer(s)`,
  );

  console.log("\n3. reconcile (repay from earnings if safe)...");
  const vault = await tl.vaultState();
  const balance = await tl.usdcBalanceUsdc();
  console.log(`   owed ${vault.amountOwedUsdc} USDC, balance ${balance} USDC, buffer ${BUFFER_USDC}`);
  if (vault.amountOwedUsdc > 0 && balance > BUFFER_USDC) {
    const repayAmt = Math.round(Math.min(vault.amountOwedUsdc, balance - BUFFER_USDC) * 100) / 100;
    if (repayAmt > 0) {
      const r = await tl.repay(repayAmt);
      console.log(`   repaid ${repayAmt} USDC → ${r.txHash}`);
    } else {
      console.log("   nothing safely repayable this pass");
    }
  } else {
    console.log("   no debt, or balance too low to keep buffer — nothing to do");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
