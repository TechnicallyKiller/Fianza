// api/ — REST endpoints the frontend needs (Fastify).
//
// Borrower dashboard: revenue, score/limit, proof, attestation for one agent.
// Lender dashboard: list of underwritten agents. Settlement contract ids +
// network come from /config so the frontend can wire wallet flows.

import { readFileSync } from "node:fs";
import { createHmac, timingSafeEqual } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "../config.js";
import { indexRevenue } from "../indexer/index.js";
import { underwrite, previewCredit, getResult, listResults } from "../underwrite.js";
import { signerPublicKey, recordRepayment } from "../signer/index.js";
import { dbConfigured, migrate } from "../db/index.js";
import { startContinuousIngest } from "../indexer/persistent.js";
import { addToWaitlist, waitlistCount, isValidEmail } from "../waitlist.js";
import { drip, faucetConfigured, hasClaimed } from "../faucet.js";
import { defindexStatus } from "../integrations/defindex.js";
import { taelRevenueReport } from "../integrations/tael.js";
import { ensureLiquidity, treasuryConfigured, treasuryPublicKey } from "../treasury.js";
import { getPortfolio } from "../portfolio.js";

// Max age of a Tael partner signature we'll accept (replay window). Tael stamps
// x-tael-timestamp as Date.now() ms; anything older than this is rejected.
const TAEL_SIG_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify Tael's `x-tael-agent-sig` HMAC on a proxied call. Mirrors their
 * construction exactly (apps/api/src/modules/gateway/upstream.ts):
 *   sig = HMAC_SHA256(PARTNER_HMAC_SECRET, `${timestamp}.${agentAddress}`)  (hex)
 *
 * Returns { ok: true } when verification passes OR when no secret is configured
 * (endpoint stays open — lets us deploy before exchanging the secret). Returns
 * { ok: false, reason } only when a secret IS set and the signature is
 * missing / stale / wrong.
 */
function verifyTaelSignature(headers: {
  agent?: string;
  timestamp?: string;
  sig?: string;
}): { ok: true } | { ok: false; reason: string } {
  const secret = config.tael.partnerHmacSecret;
  if (!secret) return { ok: true }; // verification disabled until the secret is set

  const { agent, timestamp, sig } = headers;
  if (!agent || !timestamp || !sig) {
    return { ok: false, reason: "missing x-tael-agent / x-tael-timestamp / x-tael-agent-sig" };
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > TAEL_SIG_MAX_AGE_MS) {
    return { ok: false, reason: "stale or invalid x-tael-timestamp" };
  }
  const expected = createHmac("sha256", secret).update(`${ts}.${agent}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature mismatch" };
  }
  return { ok: true };
}

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  // Persistence + continuous graph indexing (Track C), only when a DB is set.
  if (dbConfigured()) {
    await migrate();
    app.log.info("database configured — schema ready, starting continuous indexer");
    startContinuousIngest();
  } else {
    app.log.warn("DATABASE_URL not set — using in-memory store (state lost on restart)");
  }

  app.get("/health", async () => ({ ok: true, ts: Date.now() }));

  // DeFindex yield-on-idle integration status (lender-side), for the /lender UI.
  // Read-only; live DeFindex vault TVL + APY (when a key is set), plus the
  // testnet asset-fragmentation note and mainnet-compatibility flag.
  app.get("/integrations/defindex", async () => {
    try {
      return await defindexStatus();
    } catch (e) {
      return { configured: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  // TrustLine treasury (testnet lender-of-first-resort): ensure an agent's
  // vault has enough borrowable liquidity, seeding it from the treasury if
  // short. Called by a borrow flow before it borrows, or manually to pre-fund a
  // vault. Body: { neededUsdc: number }. Inert (deposited:false) if
  // TREASURY_SECRET is unset. TESTNET bootstrap — see treasury.ts.
  app.post<{ Params: { address: string }; Body: { neededUsdc?: number } }>(
    "/agent/:address/ensure-liquidity",
    async (req, reply) => {
      const needed = Number(req.body?.neededUsdc);
      if (!Number.isFinite(needed) || needed <= 0) {
        return reply.code(400).send({ error: "body must be { neededUsdc: positive number }" });
      }
      return ensureLiquidity(req.params.address, needed);
    },
  );

  // Treasury status (no secret) — is it configured, and which wallet is it.
  app.get("/treasury", async () => ({
    configured: treasuryConfigured(),
    address: treasuryPublicKey(),
    maxPerVaultUsdc: config.treasuryMaxPerVaultUsdc,
  }));

  // Public config for the frontend (no secrets).
  app.get("/config", async () => ({
    network: config.network,
    sorobanRpcUrl: config.sorobanRpcUrl,
    networkPassphrase: config.networkPassphrase,
    usdcSac: config.usdcSac,
    reclaimVerifierContractId: config.reclaimVerifierContractId,
    scoreRegistryContractId: config.scoreRegistryContractId || null,
    creditLineContractId: config.creditLineContractId || null,
    lendingVaultContractId: config.lendingVaultContractId || null,
    signer: signerPublicKey(),
    excludeAddresses: config.excludeAddresses,
  }));

  app.get("/signer", async () => ({ signer: signerPublicKey() }));

  // Early-access waitlist. POST { email } to join; GET count for display.
  app.post<{ Body: { email?: string; source?: string } }>(
    "/waitlist",
    async (req, reply) => {
      const email = req.body?.email;
      if (!email || !isValidEmail(email)) {
        return reply.code(400).send({ error: "a valid email is required" });
      }
      const { added } = await addToWaitlist(email, req.body?.source);
      return { ok: true, added };
    },
  );

  app.get("/waitlist/count", async () => ({ count: await waitlistCount() }));

  // Testnet USDC faucet — one-time drip per address. The recipient must
  // already be funded (Friendbot) with an open USDC trustline; the faucet
  // only covers the "where do I get testnet USDC" gap, not account creation.
  app.get("/faucet/status", async () => ({
    configured: faucetConfigured(),
    dripUsdc: config.faucetDripUsdc,
  }));

  app.post<{ Body: { address?: string } }>("/faucet", async (req, reply) => {
    const address = req.body?.address;
    if (!address) {
      return reply.code(400).send({ error: "body must be { address: string }" });
    }
    if (!faucetConfigured()) {
      return reply.code(503).send({
        error: "faucet not funded yet — ask in the TrustLine community for testnet USDC",
      });
    }
    if (await hasClaimed(address)) {
      return reply.code(409).send({ error: "this address has already claimed the faucet" });
    }
    try {
      const result = await drip(address);
      return { ok: true, ...result };
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // The two showcase agents for the self-serve /demo page. Env-first (Render);
  // falls back to the local seeder output (/tmp) for dev.
  app.get("/demo", async () => {
    let honest = config.demoHonestAgent;
    let sybil = config.demoSybilAgent;
    let fromLedger = config.demoFromLedger;
    if (!honest || !sybil || !fromLedger) {
      try {
        const d = JSON.parse(readFileSync("/tmp/_demo_agents.json", "utf8"));
        honest = honest || d.honestAgentPub;
        sybil = sybil || d.sybilAgentPub;
        fromLedger = fromLedger || d.fromLedger;
      } catch {
        /* no local seed file */
      }
    }
    return {
      honestAgent: honest || null,
      sybilAgent: sybil || null,
      fromLedger: fromLedger || null,
      // Real, immutable settlement txs from the recorded autonomous run.
      txs: {
        register: "d6b99f256cdb3b3d1d856809733c4b99ec7f1dc3abb4f968769e635b27a5a669",
        scorePublished: "7d113ede5a77a34696e9fa00142db80c02ca74be5dde866322054daef4fadc11",
        deposit: "4bf6a210842b67520f8dd6dc99f7d0bc635e9400f8b1665b3b830c1de352d2ea",
        borrow: "98b3f5625d9eea49c19ffde5e9a6db6ba462de1c407f9fa7c6ea750fbd515788",
        repay: "c58f02438d5a0d9b9a5b217d891a2161c8bb368f26af3efaf33d6d7055684bfc",
        drawOn402: "b43c09987f4ed41cc43d0386c2202dbfd9e87e80834e70cafd206080628f409e",
      },
    };
  });

  // Live x402 revenue index for an agent (cheap read).
  app.get<{ Params: { address: string }; Querystring: { fromLedger?: string } }>(
    "/agent/:address/revenue",
    async (req) =>
      indexRevenue(req.params.address, {
        fromLedger: req.query.fromLedger ? Number(req.query.fromLedger) : undefined,
      }),
  );

  // Live Tael-attributed USDC revenue for an agent (cheap read, memo-filtered
  // Horizon walk) — null revenue means either no Tael income yet or
  // TAEL_USDC_ISSUER isn't configured.
  app.get<{ Params: { address: string } }>("/agent/:address/tael-revenue", async (req) =>
    taelRevenueReport(req.params.address),
  );

  // Full underwriting pass: index + Reclaim proof + score + attest (+ submit).
  app.post<{
    Params: { address: string };
    Querystring: { skipProof?: string; fromLedger?: string };
  }>("/agent/:address/underwrite", async (req) =>
    underwrite(req.params.address, {
      skipProof: req.query.skipProof === "true",
      fromLedger: req.query.fromLedger ? Number(req.query.fromLedger) : undefined,
    }),
  );

  // Record a repayment outcome on-chain, then re-underwrite so the agent's score
  // reflects it immediately. `onTime: false` is the default path — it records the
  // miss (feeding the on-chain credit ramp) and the fresh score collapses below
  // lending grade. Body: { onTime: boolean }.
  app.post<{ Params: { address: string }; Body: { onTime?: boolean } }>(
    "/agent/:address/repayment",
    async (req, reply) => {
      if (typeof req.body?.onTime !== "boolean") {
        return reply.code(400).send({ error: "body must be { onTime: boolean }" });
      }
      const record = await recordRepayment(req.params.address, req.body.onTime);
      // Re-underwrite (revenue-only, fast) so the stored score reflects the outcome.
      const result = await underwrite(req.params.address, { skipProof: true });
      return { record, score: result.score.score, tier: result.score.tier, defaulted: result.score.defaulted };
    },
  );

  // Live credit read for third-party integrations (e.g. a Tael "credit"
  // capability — see TRUSTLINE_INTEGRATION.md). Runs a READ-ONLY underwriting
  // pass on demand (previewCredit): indexes the agent's real on-chain revenue
  // right now — RPC + graph + Horizon + additive Tael income — plus the
  // anti-Sybil independence check and repayment history, then scores it. No
  // zkTLS proof, no attestation, nothing written on-chain or persisted, so it's
  // cheap enough to call per request. Unlike reading a stored result, this
  // returns a real number even for an agent that's never been formally
  // underwritten — which is the whole point (otherwise every uncalled agent
  // reads 0).
  //
  // rampedLimitUsdc is the ramped CEILING (what the vault will let it draw up
  // to), NOT limit-minus-outstanding — the precise live available-to-borrow
  // figure needs a real-time vault read (the SDK's availableCreditUsdc()).
  app.get<{ Params: { address: string } }>("/agent/:address/available-credit", async (req, reply) => {
    // When a Tael partner secret is configured, require a valid signature so
    // only calls that genuinely came through Tael's gateway are honored. No
    // secret set → open (unchanged). See verifyTaelSignature above.
    const agentHeader = req.headers["x-tael-agent"];
    const check = verifyTaelSignature({
      agent: typeof agentHeader === "string" ? agentHeader : undefined,
      timestamp: typeof req.headers["x-tael-timestamp"] === "string" ? req.headers["x-tael-timestamp"] : undefined,
      sig: typeof req.headers["x-tael-agent-sig"] === "string" ? req.headers["x-tael-agent-sig"] : undefined,
    });
    if (!check.ok) {
      return reply.code(401).send({ error: `Tael signature check failed: ${check.reason}` });
    }
    // If verified, the signed agent must be the one being queried — a valid
    // sig for agent A can't be used to read agent B's credit via the path.
    if (config.tael.partnerHmacSecret && agentHeader !== req.params.address) {
      return reply.code(401).send({ error: "x-tael-agent does not match the queried address" });
    }

    try {
      const score = await previewCredit(req.params.address);
      return {
        agent: req.params.address,
        rampedLimitUsdc: score.rampedLimitUsdc,
        limitUsdc: score.limitUsdc,
        tier: score.tier,
        aprBps: score.aprBps,
        revenueUsdc: score.revenueUsdc,
        distinctPayers: score.distinctPayers,
      };
    } catch (e) {
      req.log.error(e, "previewCredit failed");
      // Never 500 a marketplace read — a scoring/RPC hiccup returns zeros, same
      // shape as an agent with no revenue.
      return reply.code(200).send({ agent: req.params.address, rampedLimitUsdc: 0, limitUsdc: 0, tier: 0, aprBps: 0, revenueUsdc: 0, distinctPayers: 0 });
    }
  });

  // Last stored underwriting result for an agent.
  app.get<{ Params: { address: string } }>("/agent/:address", async (req, reply) => {
    const r = await getResult(req.params.address);
    if (!r) return reply.code(404).send({ error: "not underwritten yet" });
    return r;
  });

  // All underwritten agents (lender dashboard).
  app.get("/agents", async () =>
    (await listResults()).map((r) => ({
      agent: r.agent,
      score: r.score.score,
      tier: r.score.tier,
      limitUsdc: r.score.limitUsdc,
      aprBps: r.score.aprBps,
      revenueUsdc: r.score.revenueUsdc,
      distinctPayers: r.revenue.distinctPayers,
      underwroteAt: r.underwroteAt,
    })),
  );

  // Protocol-wide risk/portfolio view: total lent, utilization, reserve
  // coverage, default rate, lender yield, per-agent positions. Read-only
  // (simulates vault state()). This is the "credit book" dashboard.
  app.get("/portfolio", async () => {
    try {
      return await getPortfolio();
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });

  return app;
}

async function main() {
  const app = await buildServer();
  await app.listen({ port: config.port, host: config.host });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
