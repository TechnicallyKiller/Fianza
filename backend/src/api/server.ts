// api/ — REST endpoints the frontend needs (Fastify).
//
// Borrower dashboard: revenue, score/limit, proof, attestation for one agent.
// Lender dashboard: list of underwritten agents. Settlement contract ids +
// network come from /config so the frontend can wire wallet flows.

import { readFileSync } from "node:fs";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "../config.js";
import { indexRevenue } from "../indexer/index.js";
import { underwrite, getResult, listResults } from "../underwrite.js";
import { signerPublicKey, recordRepayment } from "../signer/index.js";
import { dbConfigured, migrate } from "../db/index.js";
import { startContinuousIngest } from "../indexer/persistent.js";
import { addToWaitlist, waitlistCount, isValidEmail } from "../waitlist.js";
import { drip, faucetConfigured, hasClaimed } from "../faucet.js";
import { defindexStatus } from "../integrations/defindex.js";
import { taelRevenueReport } from "../integrations/tael.js";

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

  // Cheap, stable read for third-party integrations (e.g. a Tael "credit"
  // capability — see TRUSTLINE_INTEGRATION.md): the last stored underwriting
  // result's credit-relevant fields only, no live on-chain simulate.
  //
  // rampedLimitUsdc is the agent's current ramped CEILING (what the vault
  // contract will let it draw up to), NOT limit-minus-outstanding — getting
  // the true live available-to-borrow figure requires a real-time vault read
  // (see the SDK's availableCreditUsdc(), which this endpoint deliberately
  // does not replicate, to stay a cheap, no-chain-read call). Callers that
  // need the precise live number should read the vault directly, same as the
  // SDK does; this is a discovery/estimate signal, not the source of truth.
  app.get<{ Params: { address: string } }>("/agent/:address/available-credit", async (req, reply) => {
    const r = await getResult(req.params.address);
    if (!r) {
      return reply.code(200).send({ agent: req.params.address, rampedLimitUsdc: 0, tier: 0, aprBps: 0 });
    }
    return {
      agent: req.params.address,
      rampedLimitUsdc: r.score.rampedLimitUsdc,
      tier: r.score.tier,
      aprBps: r.score.aprBps,
    };
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
