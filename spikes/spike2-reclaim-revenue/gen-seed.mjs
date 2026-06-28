// Generate a 12-word SEEDPHRASE, derive the Stellar testnet account the SAME way
// the repo does (stellar-hd-wallet getSecret(0)), friendbot-fund it, write .env.
import fs from "node:fs";
import StellarHDWallet from "stellar-hd-wallet";
import pkg from "stellar-sdk";
const { Keypair } = pkg;

// If a SEEDPHRASE already exists in .env, reuse it (idempotent).
let mnemonic = null;
try {
  const envTxt = fs.readFileSync(".env", "utf8");
  const m = envTxt.match(/^SEEDPHRASE=(.+)$/m);
  if (m && m[1].trim()) mnemonic = m[1].trim();
} catch {}

if (!mnemonic) mnemonic = StellarHDWallet.generateMnemonic({ entropyBits: 128 }); // 12 words

const wallet = StellarHDWallet.fromMnemonic(mnemonic);
const secret = wallet.getSecret(0);
const kp = Keypair.fromSecret(secret);
const pub = kp.publicKey();

fs.writeFileSync(".env", `SEEDPHRASE=${mnemonic}\n`);
console.log("SEEDPHRASE words:", mnemonic.split(" ").length);
console.log("Derived public key:", pub);

// Fund via friendbot (idempotent: ok if already funded)
const r = await fetch(`https://friendbot.stellar.org?addr=${pub}`);
const body = await r.text();
if (r.ok) console.log("friendbot: funded");
else if (body.includes("op_already_exists") || body.includes("createAccountAlreadyExist")) console.log("friendbot: already funded");
else console.log("friendbot status:", r.status, body.slice(0, 200));

// Confirm balance via Horizon
const h = await fetch(`https://horizon-testnet.stellar.org/accounts/${pub}`);
if (h.ok) {
  const acc = await h.json();
  const xlm = acc.balances.find((b) => b.asset_type === "native");
  console.log("XLM balance:", xlm ? xlm.balance : "?");
} else {
  console.log("account not found yet (status", h.status + ")");
}
console.log("PUBKEY=" + pub);
