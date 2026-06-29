// One-off: generate the trusted score-signer keypair, write backend/.env, and
// fund the signer on testnet. Prints only the public key + secret last4.
import { Keypair } from "@stellar/stellar-sdk";
import fs from "node:fs";

const k = Keypair.random();
const env =
  `SCORE_SIGNER_SECRET=${k.secret()}\n` +
  `MIN_COUNTERPARTIES=3\n` +
  `PORT=8787\n` +
  `HOST=0.0.0.0\n` +
  `SCORE_REGISTRY_CONTRACT_ID=\n`;
fs.writeFileSync(new URL("../.env", import.meta.url), env);

console.log("signer public key:", k.publicKey());
console.log("signer secret last4:", k.secret().slice(-4));
const r = await fetch(`https://friendbot.stellar.org?addr=${k.publicKey()}`);
console.log("friendbot fund: HTTP", r.status);
