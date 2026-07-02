// independence/ — counterparty-independence (anti-Sybil) analysis.
//
// zkTLS + the indexer prove revenue is REAL. This proves it's INDEPENDENT — that
// the agent isn't manufacturing a score from wallets/relationships it controls.
// See docs/sybil-model.md. This is the moat: reading inflows is a SELECT; judging
// whether they're genuine independent economic activity is the hard part.
//
// The model turns raw per-payer revenue into **effective independent revenue**
// (`R_eff`) via a per-payer weight `w_i = age · diversity · not_funded`, a
// concentration penalty (HHI), and a coarse temporal-organicity factor. `R_eff`
// (not raw on-chain revenue) is what feeds `computeScore`.
//
// Design note: the pure scoring math (`scoreIndependence`) is separated from the
// on-chain graph gathering so the adversarial attack catalog can be tested
// deterministically without funding testnet wallets.

import { rpc, xdr, scValToNative, Address } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import type { RevenueReport } from "../indexer/index.js";
import { dbConfigured } from "../db/index.js";
import * as graph from "./graph.js";

const server = new rpc.Server(config.sorobanRpcUrl, { allowHttp: false });

// ---- Tunable parameters (docs/sybil-model.md §7) ---------------------------
const MAX_HOPS = Number(process.env.INDEP_MAX_HOPS ?? "3"); // loop-detection depth
const AGE_FULL_DAYS = Number(process.env.INDEP_AGE_FULL_DAYS ?? "30"); // age → full weight
const DIVERSITY_FULL = Number(process.env.INDEP_DIVERSITY_FULL ?? "3"); // out-degree → full
const MAX_PAYER_SHARE = Number(process.env.INDEP_MAX_PAYER_SHARE ?? "0.40"); // per-payer cap
const HHI_FLOOR = Number(process.env.INDEP_HHI_FLOOR ?? "0.15"); // concentration tolerance
const ORGANICITY_FLOOR = Number(process.env.INDEP_ORGANICITY_FLOOR ?? "0.50");
// A payer counts as an "independent counterparty" (for the counterparty count)
// once its weight clears this.
const INDEPENDENT_WEIGHT_THRESHOLD = 0.5;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// ---- Pure facts → independence score (deterministic, unit-tested) ----------

/** Everything the model needs to know about one payer, gathered from-chain. */
export interface PayerFacts {
  payer: string;
  revenueStroops: bigint;
  /** Account age in days (0 = brand new). Defeats fresh-wallet farms (A2). */
  ageDays: number;
  /** Distinct counterparties the payer transacts with, EXCLUDING this agent and
   *  the agent's *other* payers. A payer that only deals with this agent is a
   *  puppet (A1); one that only deals with the agent + co-payers is a ring
   *  member (A7) — both show low external out-degree. */
  outDegree: number;
  /** True if the payer's USDC was funded by the agent within K hops (A3). */
  fundedByAgent: boolean;
  /** How much the agent paid THIS payer back over the window (stroops). Real
   *  customers aren't paid by the vendor; a collusion ring cross-pays, so a high
   *  reciprocated flow nets the "revenue" toward zero (A7). */
  agentPaidStroops?: bigint;
  /** Inter-payment gaps (secs) for this payer, for the temporal signal (A5). */
  intervalsSecs?: number[];
}

export interface PayerWeight {
  payer: string;
  revenueStroops: string;
  cappedStroops: string;
  ageFactor: number;
  diversityFactor: number;
  notFundedFactor: number;
  reciprocityFactor: number;
  weight: number; // w_i
  effectiveStroops: string; // w_i · capped
  independent: boolean;
  reason: string;
}

export interface IndependenceResult {
  independentPayers: string[];
  circularPayers: string[];
  /** Effective independent revenue (R_eff), in stroops — this feeds scoring. */
  independentRevenueStroops: string;
  /** independence_score = R_eff / Σ raw revenue, in [0,1]. */
  independenceScore: number;
  concentrationFactor: number;
  organicityFactor: number;
  hhi: number;
  perPayer: PayerWeight[];
  params: {
    maxHops: number;
    ageFullDays: number;
    diversityFull: number;
    maxPayerShare: number;
    hhiFloor: number;
  };
  maxHops: number;
}

/** Coefficient-of-variation-based organicity: scripted (regular) cadence scores
 *  lower than bursty/organic. Soft signal, floored so it never hard-fails. */
function organicityFactor(allIntervals: number[]): number {
  if (allIntervals.length < 3) return 1; // too little data to penalize
  const mean = allIntervals.reduce((a, b) => a + b, 0) / allIntervals.length;
  if (mean <= 0) return 1;
  const variance =
    allIntervals.reduce((a, b) => a + (b - mean) ** 2, 0) / allIntervals.length;
  const cv = Math.sqrt(variance) / mean; // 0 = perfectly regular (scripted)
  // Map CV∈[0,~1] → factor∈[floor,1]: low CV (regular) → floor, high CV → 1.
  return ORGANICITY_FLOOR + (1 - ORGANICITY_FLOOR) * clamp01(cv);
}

/**
 * Pure independence scoring: per-payer facts → R_eff + per-payer breakdown.
 * No I/O — this is the deterministically-testable core of the moat.
 */
export function scoreIndependence(facts: PayerFacts[]): IndependenceResult {
  const totalRaw = facts.reduce((a, f) => a + f.revenueStroops, 0n);
  const params = {
    maxHops: MAX_HOPS,
    ageFullDays: AGE_FULL_DAYS,
    diversityFull: DIVERSITY_FULL,
    maxPayerShare: MAX_PAYER_SHARE,
    hhiFloor: HHI_FLOOR,
  };

  if (totalRaw <= 0n) {
    return {
      independentPayers: [],
      circularPayers: [],
      independentRevenueStroops: "0",
      independenceScore: 0,
      concentrationFactor: 1,
      organicityFactor: 1,
      hhi: 0,
      perPayer: [],
      params,
      maxHops: MAX_HOPS,
    };
  }

  // Per-payer contribution cap (defeats concentration, A4).
  const capStroops = BigInt(Math.floor(MAX_PAYER_SHARE * Number(totalRaw)));

  const perPayer: PayerWeight[] = [];
  const independentPayers: string[] = [];
  const circularPayers: string[] = [];
  let cappedTotal = 0n;
  let effectiveSum = 0n;
  const cappedByPayer: bigint[] = [];

  for (const f of facts) {
    const capped = f.revenueStroops < capStroops ? f.revenueStroops : capStroops;
    cappedTotal += capped;
    cappedByPayer.push(capped);

    const ageFactor = clamp01(f.ageDays / AGE_FULL_DAYS);
    const diversityFactor = clamp01(f.outDegree / DIVERSITY_FULL);
    const notFundedFactor = f.fundedByAgent ? 0 : 1;
    // Net-flow / reciprocity: subtract what the agent paid this payer back. A
    // mutual-paying collusion ring (A7) nets toward zero here.
    const agentPaid = f.agentPaidStroops ?? 0n;
    const reciprocityFactor =
      f.revenueStroops > 0n
        ? clamp01(1 - Number(agentPaid) / Number(f.revenueStroops))
        : 1;
    const weight = ageFactor * diversityFactor * notFundedFactor * reciprocityFactor;
    const effective = BigInt(Math.floor(weight * Number(capped)));
    effectiveSum += effective;

    const independent = weight >= INDEPENDENT_WEIGHT_THRESHOLD;
    if (f.fundedByAgent) circularPayers.push(f.payer);
    if (independent) independentPayers.push(f.payer);

    const reason = f.fundedByAgent
      ? "funded by the agent within K hops — circular (A3)"
      : reciprocityFactor < 0.3
        ? `discounted: agent pays this payer back (reciprocity ${(1 - reciprocityFactor).toFixed(2)}) — ring/wash (A7)`
        : weight < 0.05
          ? `discounted: age=${f.ageDays.toFixed(1)}d, external out-degree=${f.outDegree} (fresh/puppet/ring, A1/A2/A7)`
          : independent
            ? "independent counterparty"
            : `partially discounted, weight=${weight.toFixed(2)}`;

    perPayer.push({
      payer: f.payer,
      revenueStroops: f.revenueStroops.toString(),
      cappedStroops: capped.toString(),
      ageFactor,
      diversityFactor,
      notFundedFactor,
      reciprocityFactor,
      weight,
      effectiveStroops: effective.toString(),
      independent,
      reason,
    });
  }

  // Concentration penalty via normalized Herfindahl index over capped shares.
  let hhi = 0;
  if (cappedTotal > 0n) {
    for (const c of cappedByPayer) {
      const share = Number(c) / Number(cappedTotal);
      hhi += share * share;
    }
  }
  const concentrationFactor = 1 - clamp01((hhi - HHI_FLOOR) / (1 - HHI_FLOOR));

  const allIntervals = facts.flatMap((f) => f.intervalsSecs ?? []);
  const organicity = organicityFactor(allIntervals);

  // R_eff = concentration · organicity · Σ (w_i · capped_i)
  const rEff = BigInt(
    Math.floor(concentrationFactor * organicity * Number(effectiveSum)),
  );
  const independenceScore = clamp01(Number(rEff) / Number(totalRaw));

  return {
    independentPayers,
    circularPayers,
    independentRevenueStroops: rEff.toString(),
    independenceScore,
    concentrationFactor,
    organicityFactor: organicity,
    hhi,
    perPayer,
    params,
    maxHops: MAX_HOPS,
  };
}

// ---- On-chain graph gathering (I/O; exercised live) ------------------------

function native(t: unknown): unknown {
  const sv = typeof t === "string" ? xdr.ScVal.fromXDR(t, "base64") : (t as xdr.ScVal);
  return scValToNative(sv);
}

/** getEvents with a small retry on transient network drops (undici "fetch
 *  failed", resets, DNS blips). The engine fans out many of these; one flaky
 *  socket must not abort the whole independence analysis. */
async function getEventsRetry(
  req: rpc.Server.GetEventsRequest,
  attempts = 4,
): Promise<rpc.Api.GetEventsResponse> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await server.getEvents(req);
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!/fetch failed|ECONN|ETIMEDOUT|socket|network|EAI_AGAIN|other side closed/i.test(msg)) {
        throw e; // real error (e.g. ledger-range) — let the caller handle it
      }
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastErr;
}

/** Distinct accounts that have sent USDC *to* `account` (topic-filtered scan). */
async function fundersOf(account: string, fromLedger: number): Promise<Set<string>> {
  return usdcCounterparties(account, "to", fromLedger);
}

/**
 * Distinct USDC counterparties of `account` on one side of the transfer:
 * side="to" → who sent it money (funders); side="from" → who it sent money to.
 */
async function usdcCounterparties(
  account: string,
  side: "from" | "to",
  fromLedger: number,
): Promise<Set<string>> {
  const transferSym = xdr.ScVal.scvSymbol("transfer").toXDR("base64");
  const acctTopic = Address.fromString(account).toScVal().toXDR("base64");
  const topics =
    side === "to"
      ? [[transferSym, "*", acctTopic, "*"]] // transfers TO account → senders (topic[1])
      : [[transferSym, acctTopic, "*", "*"]]; // transfers FROM account → recipients (topic[2])
  const filters = [{ type: "contract" as const, contractIds: [config.usdcSac], topics }];
  const others = new Set<string>();
  let start = fromLedger;
  let cursor: string | undefined;
  const otherIdx = side === "to" ? 1 : 2;

  for (let page = 0; page < 20; page++) {
    let resp: rpc.Api.GetEventsResponse;
    try {
      resp = cursor
        ? await getEventsRetry({ filters, limit: 200, cursor } as rpc.Server.GetEventsRequest)
        : await getEventsRetry({ startLedger: start, filters, limit: 200 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const m = /ledger range:\s*(\d+)\s*-\s*(\d+)/.exec(msg);
      if (m && !cursor) {
        start = Math.min(Math.max(start, Number(m[1])), Number(m[2]));
        resp = await getEventsRetry({ startLedger: start, filters, limit: 200 });
      } else {
        throw e;
      }
    }
    for (const e of resp.events ?? []) {
      const other = native((e.topic as unknown[])[otherIdx]);
      if (typeof other === "string") others.add(other);
    }
    cursor = resp.cursor;
    if (!cursor || (resp.events ?? []).length === 0) break;
  }
  return others;
}

/** Does `payer`'s USDC funding trace back to `agent` within MAX_HOPS? (a loop) */
async function fundedByAgent(payer: string, agent: string, fromLedger: number): Promise<boolean> {
  const exclude = new Set(config.excludeAddresses);
  const visited = new Set<string>([agent]);
  let frontier = [payer];
  for (let hop = 0; hop < MAX_HOPS && frontier.length > 0; hop++) {
    const next: string[] = [];
    for (const acct of frontier) {
      if (visited.has(acct)) continue;
      visited.add(acct);
      const funders = await fundersOf(acct, fromLedger);
      if (funders.has(agent)) return true; // agent → … → payer → agent
      for (const f of funders) if (!visited.has(f) && !exclude.has(f)) next.push(f);
    }
    frontier = next;
  }
  return false;
}

/** Account age in days from the first Horizon operation (best-effort). */
async function ageDaysOf(account: string): Promise<number> {
  try {
    const url = `${config.horizonUrl}/accounts/${account}/operations?order=asc&limit=1`;
    const r = await fetch(url);
    if (!r.ok) return 0;
    const j = (await r.json()) as { _embedded?: { records?: { created_at?: string }[] } };
    const createdAt = j._embedded?.records?.[0]?.created_at;
    if (!createdAt) return 0;
    return Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  } catch {
    return 0;
  }
}

/** External out-degree: distinct counterparties (both directions) EXCLUDING the
 *  agent and the agent's co-payers (`coPayers`). A ring member whose only
 *  counterparties are the agent + fellow ring members scores ~0 here (A7). */
async function outDegreeOf(
  payer: string,
  agent: string,
  fromLedger: number,
  coPayers: Set<string>,
): Promise<number> {
  const exclude = new Set([...config.excludeAddresses, agent, payer, ...coPayers]);
  const [sent, recv] = await Promise.all([
    usdcCounterparties(payer, "from", fromLedger),
    usdcCounterparties(payer, "to", fromLedger),
  ]);
  const others = new Set<string>();
  for (const a of sent) if (!exclude.has(a)) others.add(a);
  for (const a of recv) if (!exclude.has(a)) others.add(a);
  return others.size;
}

/** Total USDC sent `from → to` over the window (summed transfer amounts). */
async function sumTransfers(from: string, to: string, fromLedger: number): Promise<bigint> {
  const transferSym = xdr.ScVal.scvSymbol("transfer").toXDR("base64");
  const fromTopic = Address.fromString(from).toScVal().toXDR("base64");
  const toTopic = Address.fromString(to).toScVal().toXDR("base64");
  const filters = [
    {
      type: "contract" as const,
      contractIds: [config.usdcSac],
      topics: [[transferSym, fromTopic, toTopic, "*"]],
    },
  ];
  let total = 0n;
  let start = fromLedger;
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    let resp: rpc.Api.GetEventsResponse;
    try {
      resp = cursor
        ? await getEventsRetry({ filters, limit: 200, cursor } as rpc.Server.GetEventsRequest)
        : await getEventsRetry({ startLedger: start, filters, limit: 200 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const m = /ledger range:\s*(\d+)\s*-\s*(\d+)/.exec(msg);
      if (m && !cursor) {
        start = Math.min(Math.max(start, Number(m[1])), Number(m[2]));
        resp = await getEventsRetry({ startLedger: start, filters, limit: 200 });
      } else {
        throw e;
      }
    }
    for (const e of resp.events ?? []) {
      const amt = native(e.value);
      if (typeof amt === "bigint") total += amt;
      else if (typeof amt === "number") total += BigInt(amt);
    }
    cursor = resp.cursor;
    if (!cursor || (resp.events ?? []).length === 0) break;
  }
  return total;
}

/** Gather the on-chain facts for each payer (age, out-degree, circular). */
async function gatherPayerFacts(
  agent: string,
  report: RevenueReport,
  fromLedger: number,
): Promise<PayerFacts[]> {
  const revByPayer = new Map<string, bigint>();
  const ledgersByPayer = new Map<string, number[]>();
  for (const p of report.payments) {
    revByPayer.set(p.from, (revByPayer.get(p.from) ?? 0n) + BigInt(p.amount));
    const arr = ledgersByPayer.get(p.from) ?? [];
    arr.push(p.ledger);
    ledgersByPayer.set(p.from, arr);
  }

  const coPayers = new Set(report.payers);
  return Promise.all(
    report.payers.map(async (payer) => {
      const [ageDays, outDegree, funded, agentPaid] = await Promise.all([
        ageDaysOf(payer),
        outDegreeOf(payer, agent, fromLedger, coPayers),
        fundedByAgent(payer, agent, fromLedger),
        sumTransfers(agent, payer, fromLedger), // agent → payer (reciprocity)
      ]);
      // Approximate inter-payment gaps from ledger spacing (~5s/ledger).
      const ledgers = (ledgersByPayer.get(payer) ?? []).sort((a, b) => a - b);
      const intervalsSecs = ledgers.slice(1).map((l, i) => (l - ledgers[i]) * 5);
      return {
        payer,
        revenueStroops: revByPayer.get(payer) ?? 0n,
        ageDays,
        outDegree,
        fundedByAgent: funded,
        agentPaidStroops: agentPaid,
        intervalsSecs,
      };
    }),
  );
}

/** Gather per-payer facts from the persisted graph (full history, not the ~24h
 *  RPC window) — age, external out-degree, funding ancestry, reciprocity. */
async function gatherPayerFactsFromGraph(
  agent: string,
  report: RevenueReport,
): Promise<PayerFacts[]> {
  const revByPayer = new Map<string, bigint>();
  for (const p of report.payments) {
    revByPayer.set(p.from, (revByPayer.get(p.from) ?? 0n) + BigInt(p.amount));
  }
  const coPayers = [...new Set(report.payers)];
  return Promise.all(
    report.payers.map(async (payer) => {
      const [ageDays, outDegree, funded, agentPaid] = await Promise.all([
        graph.ageDays(payer),
        graph.externalOutDegree(payer, coPayers, agent),
        graph.fundedByAgent(payer, agent, MAX_HOPS),
        graph.sumPaid(agent, payer),
      ]);
      return {
        payer,
        revenueStroops: revByPayer.get(payer) ?? 0n,
        ageDays,
        outDegree,
        fundedByAgent: funded,
        agentPaidStroops: agentPaid,
      };
    }),
  );
}

/**
 * Full independence analysis: gather each payer's facts, then score. Reads the
 * persisted payment graph (full history) when a database is configured, else
 * falls back to the ~24h RPC lookups. Returns R_eff + a per-payer breakdown the
 * API surfaces so the dashboard can show *why* revenue was discounted.
 */
export async function analyzeIndependence(
  agent: string,
  report: RevenueReport,
  fromLedger: number,
): Promise<IndependenceResult> {
  const facts = dbConfigured()
    ? await gatherPayerFactsFromGraph(agent, report)
    : await gatherPayerFacts(agent, report, fromLedger);
  return scoreIndependence(facts);
}
