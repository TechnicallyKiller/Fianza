// api/ — REST endpoints the frontend needs (Fastify).
//
// Borrower dashboard: revenue, score/limit, proof, attestation for one agent.
// Lender dashboard: list of underwritten agents. Settlement contract ids +
// network come from /config so the frontend can wire wallet flows.

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
