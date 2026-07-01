// A real lender deposits into Scout's isolated vault.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env") });

import { TrustLineAgent } from "../packages/agent-sdk/dist/index.js";

const lender = new TrustLineAgent(process.env.SCOUT_LENDER_SECRET, {
  apiBaseUrl: process.env.TRUSTLINE_API || "http://localhost:8787",
});
const amount = Number(process.argv[2] || "15");

console.log(`lender ${lender.publicKey()} depositing ${amount} USDC into Scout's isolated vault...`);
const r = await lender.deposit(process.env.SCOUT_WALLET_PUBLIC, amount);
console.log("deposit tx:", r.txHash);
