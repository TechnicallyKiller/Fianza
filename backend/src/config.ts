// Centralized, typed configuration for the underwriting engine.
//
// Secrets are reused from the already-populated `spikes/.env` (Reclaim creds,
// Stripe test key, the funded SEEDPHRASE, the deployed verifier CONTRACT_ID,
// USDC SAC, network constants) so nothing is duplicated. Backend-only settings
// (the trusted score signer, exclude list, port) come from `backend/.env` and
// override the shared values.

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// Load shared spike secrets, then spike2's own .env (holds SEEDPHRASE +
// STRIPE_TEST_KEY), then backend overrides win.
dotenv.config({ path: path.resolve(here, "../../spikes/.env"), quiet: true });
dotenv.config({
  path: path.resolve(here, "../../spikes/spike2-reclaim-revenue/.env"),
  quiet: true,
  override: true,
});
dotenv.config({ path: path.resolve(here, "../.env"), quiet: true, override: true });

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function opt(name: string, fallback = ""): string {
  const v = process.env[name];
  // Treat empty/whitespace env values as unset so defaults apply.
  return v && v.trim() !== "" ? v : fallback;
}

// Facilitator submitter + fee-payer observed in the validated spike1 settlement.
// These must never be counted as a revenue counterparty (they only ever appear
// as the tx source / fee sponsor, never as a genuine x402 payer).
const DEFAULT_EXCLUDE = [
  "GDS55JGUTDAH43XQRQGYK5NTDIO57HFA5OP6EOQ3AZ2E3GG634A2ZD5L", // facilitator submitter
  "GA6THKUY2XJZOBRFMEQMMEADSCQLCZ2QMQWAWMMDXBTE7SARKAXVH7TL", // fee sponsor
];

export const config = {
  network: opt("STELLAR_NETWORK", "testnet"),
  sorobanRpcUrl: opt("RPC_URL", "https://soroban-testnet.stellar.org"),
  horizonUrl: opt("HORIZON_URL", "https://horizon-testnet.stellar.org"),
  networkPassphrase: opt("NETWORK_PASSPHRASE", "Test SDF Network ; September 2015"),

  // x402 revenue indexing
  usdcSac: opt("USDC_TESTNET_SAC", "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"),
  usdcDecimals: 7,
  excludeAddresses: opt("X402_EXCLUDE_ADDRESSES")
    ? opt("X402_EXCLUDE_ADDRESSES").split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_EXCLUDE,

  // Reclaim zkTLS (deployed Soroban verifier from spike2). The Reclaim app
  // creds default to the validated demo values the spikes used (hardcoded in
  // spike2 config.js, not its .env); override via env if you have your own.
  reclaimAppId: opt("RECLAIM_APP_ID", "0x381994d6B9B08C3e7CfE3A4Cd544C85101b8f201"),
  reclaimAppSecret: opt(
    "RECLAIM_APP_SECRET",
    "0xfdc676e00ac9c648dfbcc271263c2dd95233a8abd391458c91ea88526a299223",
  ),
  reclaimVerifierContractId: opt("CONTRACT_ID", "CA3EMXR6JOOTNP44T3OAJFMMMGKRRETDJKBLZP2RU3SIY4SDFAH54DU5"),
  seedphrase: opt("SEEDPHRASE"), // funds the on-chain verify tx (zktls only)
  stripeTestKey: opt("STRIPE_TEST_KEY"), // off-chain revenue source (private)

  // Trusted score signer (publishes to score_registry). Backend-specific.
  scoreSignerSecret: opt("SCORE_SIGNER_SECRET"),
  scoreRegistryContractId: opt("SCORE_REGISTRY_CONTRACT_ID"), // set after Phase 4 deploy
  creditLineContractId: opt("CREDIT_LINE_CONTRACT_ID"), // Phase 4 deploy
  lendingVaultContractId: opt("LENDING_VAULT_CONTRACT_ID"), // Phase 4 deploy

  // API
  port: Number(opt("PORT", "8787")),
  host: opt("HOST", "0.0.0.0"),
} as const;

export type Config = typeof config;
