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
  "GCUVT3UH4JFHAK7APFHU655SY5QC4JQGRWH5NPGUC3RXCIBYH2NTB2UB", // testnet USDC faucet (funds new agents — never a revenue counterparty)
];

export const config = {
  network: opt("STELLAR_NETWORK", "testnet"),
  sorobanRpcUrl: opt("RPC_URL", "https://soroban-testnet.stellar.org"),
  horizonUrl: opt("HORIZON_URL", "https://horizon-testnet.stellar.org"),
  networkPassphrase: opt("NETWORK_PASSPHRASE", "Test SDF Network ; September 2015"),

  // x402 revenue indexing
  usdcSac: opt("USDC_TESTNET_SAC", "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"),
  // Classic-asset issuer for the same testnet USDC (payments to it are what the
  // faucet sends — the SAC id above is the Soroban-side contract wrapper).
  usdcIssuer: opt("USDC_TESTNET_ISSUER", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"),
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

  // Self-serve /demo page: the two pre-seeded showcase agents.
  demoHonestAgent: opt("DEMO_HONEST_AGENT"),
  demoSybilAgent: opt("DEMO_SYBIL_AGENT"),
  demoFromLedger: Number(opt("DEMO_FROM_LEDGER", "0")) || 0,

  // Persistence (Track C). When set, the payment-graph indexer + moat read from
  // Postgres (Neon) instead of being limited to the RPC's ~24h event retention.
  databaseUrl: opt("DATABASE_URL"),

  // Testnet USDC faucet — a dedicated wallet (never any agent/customer wallet,
  // to avoid the funding-contamination trap: an agent funded from our own
  // cluster gets permanently flagged as non-independent) that drips a small,
  // one-time amount of testnet USDC to new external agents. Unset until the
  // wallet is topped up.
  faucetSecret: opt("FAUCET_SECRET"),
  faucetDripUsdc: Number(opt("FAUCET_DRIP_USDC", "10")) || 10,

  // TrustLine treasury — the lender-of-first-resort that seeds liquidity into
  // an underwritten agent's isolated vault so the agent can actually BORROW
  // (a credit line is only permission; a lender must deposit the USDC that
  // backs it). On testnet TrustLine bootstraps this itself with faucet USDC.
  //
  // TESTNET-ONLY BOOTSTRAP. On mainnet, independent third-party lenders take
  // the default risk — TrustLine lending into vaults its own engine underwrote
  // is fine to kick-start a testnet demo but is NOT a mainnet posture. Gate it
  // hard: unset treasurySecret => the top-up path is inert.
  //
  // NOTE — not the same trap as the faucet: the treasury DEPOSITS into a vault
  // (lender → vault shares), it never PAYS the agent, so it does not appear as
  // agent revenue and cannot contaminate the anti-Sybil independence score.
  treasurySecret: opt("TREASURY_SECRET"),
  // Max the treasury will top up into any single agent's vault per request.
  // The treasury's own wallet USDC balance is the global cap (it can't lend
  // what it doesn't hold) — keep that wallet funded to a level you're willing
  // to expose. A precise cross-vault exposure ledger is a mainnet concern.
  treasuryMaxPerVaultUsdc: Number(opt("TREASURY_MAX_PER_VAULT_USDC", "10")) || 10,

  // DeFindex yield-on-idle integration (lender-side). Idle liquidity in a
  // DeFindex-integrated lending_vault is swept into a DeFindex vault to earn
  // Blend yield while it waits to be borrowed. Testnet-only reality: DeFindex/
  // Blend settle in their OWN testnet USDC (defindexUsdc), distinct from
  // TrustLine's main USDC with no swap pool between them — so this integration
  // runs in DeFindex's USDC. On mainnet all converge on Circle USDC and the
  // split vanishes (see docs / the /lender note).
  defindex: {
    // TrustLine's DeFindex-integrated lending_vault (token = defindexUsdc).
    integratedVault: opt("DEFINDEX_INTEGRATED_VAULT", "CBZ4IGN7XDORTZ7DFWGYSJ67BUNRN475KJB3IJUORITY76Y6RDZOJDAA"),
    // The DeFindex USDC vault the treasury sweeps idle capital into.
    treasuryVault: opt("DEFINDEX_TREASURY_VAULT", "CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN"),
    // DeFindex/Blend testnet USDC (classic-wrapped SAC, issuer GATALTGT…).
    usdc: opt("DEFINDEX_USDC", "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU"),
    // Optional hosted-API key for live APY reads (display only; the value path
    // is on-chain). Falls back to a documented figure when unset.
    apiKey: opt("DEFINDEX_API_KEY"),
    apiBaseUrl: opt("DEFINDEX_API_BASE_URL", "https://api.defindex.io"),
  },

  // Tael revenue indexing (seller-side underwriting). Tael settles as classic
  // Stellar `payment` ops (not SAC transfer events), tagged with a fixed text
  // memo, on Tael's OWN testnet USDC issuer — distinct from TrustLine's own
  // testnet USDC, same fragmentation story as DeFindex above. Reading this
  // revenue needs Tael's issuer + memo, not config.usdcIssuer/usdcSac.
  tael: {
    // Tael's testnet USDC issuer (classic asset "USDC:<issuer>", NOT a SAC).
    usdcIssuer: opt("TAEL_USDC_ISSUER"),
    // Stellar text memo Tael stamps on every settlement (packages/stellar/src/pay.ts
    // in rahulsainlll/tael-protocol: `export const TAEL_MEMO = "tael"`).
    memo: opt("TAEL_MEMO", "tael"),
    // Shared secret for verifying Tael's `x-tael-agent-sig` HMAC on proxied
    // calls (their PARTNER_HMAC_SECRET). When set, the /available-credit
    // endpoint requires a valid, fresh signature — proving the call really came
    // through Tael's gateway, not a forged x-tael-agent header. Unset = no
    // verification (open endpoint, same as before). Get the value from Tael.
    partnerHmacSecret: opt("TAEL_PARTNER_HMAC_SECRET"),
  },

  // API
  port: Number(opt("PORT", "8787")),
  host: opt("HOST", "0.0.0.0"),
} as const;

export type Config = typeof config;
