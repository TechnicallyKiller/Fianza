// Reuse the funded Phase-4b lender (GB2T6L3P, ~10 USDC) as the demo lender.
import fs from "node:fs";
import { Keypair } from "@stellar/stellar-sdk";

const TARGET = "GB2T6L3PSZ4BGJRCE5ACQ3QOKHHTGQ3Z44SBTVHGXMPECFCIORFCHH7L";
const pk = JSON.parse(fs.readFileSync("/tmp/_phase4b_keys.json", "utf8"));

let secret = null;
for (const v of Object.values(pk)) {
  if (typeof v === "string" && v.startsWith("S")) {
    try { if (Keypair.fromSecret(v).publicKey() === TARGET) secret = v; } catch {}
  }
}
if (!secret) throw new Error("could not find lender secret in _phase4b_keys.json");

const demo = JSON.parse(fs.readFileSync("/tmp/_demo_agents.json", "utf8"));
demo.lender = secret;
demo.lenderPub = TARGET;
fs.writeFileSync("/tmp/_demo_agents.json", JSON.stringify(demo, null, 2));
console.log("demo lender → reused Phase-4b lender", TARGET.slice(0, 8) + "…");
