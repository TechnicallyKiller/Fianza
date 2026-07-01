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
import { signerPublicKey } from "../signer/index.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ ok: true, ts: Date.now() }));

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

  // Last stored underwriting result for an agent.
  app.get<{ Params: { address: string } }>("/agent/:address", async (req, reply) => {
    const r = getResult(req.params.address);
    if (!r) return reply.code(404).send({ error: "not underwritten yet" });
    return r;
  });

  // All underwritten agents (lender dashboard).
  app.get("/agents", async () =>
    listResults().map((r) => ({
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
