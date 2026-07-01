// independence/ — counterparty-independence (anti-Sybil) analysis.
//
// zkTLS + the indexer prove revenue is REAL. This proves it's INDEPENDENT — that
// the agent isn't paying itself from wallets it controls to manufacture a score.
// See docs/sybil-model.md. v1 ships the cheapest high-signal slice: **fund-flow
// loop detection** — if an agent's "revenue" comes from payers the agent itself
// funded (directly or within K hops), that revenue is circular and excluded.
//
// Detection is exact and on-chain: for each payer, we walk its USDC funding
// ancestry (transfers where `to == payer`, filtered cheaply by topic) and ask
// "did this money originate from the agent?" Only revenue from payers with no
// path back to the agent counts toward the score.

import { rpc, xdr, scValToNative, Address } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import type { RevenueReport } from "../indexer/index.js";

const server = new rpc.Server(config.sorobanRpcUrl, { allowHttp: false });

/** Max hops to walk back through a payer's funding ancestry. */
const MAX_HOPS = 3;

function native(t: unknown): unknown {
  const sv = typeof t === "string" ? xdr.ScVal.fromXDR(t, "base64") : (t as xdr.ScVal);
  return scValToNative(sv);
}

/** Distinct accounts that have sent USDC *to* `account` (one cheap, topic-filtered scan). */
async function fundersOf(account: string, fromLedger: number): Promise<Set<string>> {
  const transferSym = xdr.ScVal.scvSymbol("transfer").toXDR("base64");
  const toTopic = Address.fromString(account).toScVal().toXDR("base64");
  const filters = [
    {
      type: "contract" as const,
      contractIds: [config.usdcSac],
      topics: [[transferSym, "*", toTopic, "*"]],
    },
  ];
  const funders = new Set<string>();
  let start = fromLedger;
  let cursor: string | undefined;

  for (let page = 0; page < 20; page++) {
    let resp: rpc.Api.GetEventsResponse;
    try {
      resp = cursor
        ? await server.getEvents({ filters, limit: 200, cursor } as rpc.Server.GetEventsRequest)
        : await server.getEvents({ startLedger: start, filters, limit: 200 });
    } catch (e) {
      // Clamp the start ledger into the RPC retention window if we overshot.
      const msg = e instanceof Error ? e.message : String(e);
      const m = /ledger range:\s*(\d+)\s*-\s*(\d+)/.exec(msg);
      if (m && !cursor) {
        start = Math.min(Math.max(start, Number(m[1])), Number(m[2]));
        resp = await server.getEvents({ startLedger: start, filters, limit: 200 });
      } else {
        throw e;
      }
    }
    for (const e of resp.events ?? []) {
      const from = native((e.topic as unknown[])[1]);
      if (typeof from === "string") funders.add(from);
    }
    cursor = resp.cursor;
    if (!cursor || (resp.events ?? []).length === 0) break;
  }
  return funders;
}

/** Does `payer`'s USDC funding trace back to `agent` within MAX_HOPS? (a loop) */
async function fundedByAgent(
  payer: string,
  agent: string,
  fromLedger: number,
): Promise<boolean> {
  // Excluded addresses (faucets / facilitators / funding hubs) are NOT traversed
  // through — a real self-pay loop routes the agent's OWN funds back to it, not
  // through a shared funding source. Traversing hubs causes false positives
  // (two agents funded by the same faucet would look linked).
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
      for (const f of funders) {
        if (!visited.has(f) && !exclude.has(f)) next.push(f);
      }
    }
    frontier = next;
  }
  return false;
}

export interface PayerVerdict {
  payer: string;
  revenueStroops: string;
  independent: boolean;
  reason: string;
}

export interface IndependenceResult {
  independentPayers: string[];
  circularPayers: string[];
  /** Revenue from independent payers only, in stroops (feeds scoring). */
  independentRevenueStroops: string;
  perPayer: PayerVerdict[];
  maxHops: number;
}

/**
 * Classify each of an agent's payers as independent or circular, and return the
 * revenue that survives (independent payers only). Circular revenue — money the
 * agent routed to wallets that then "paid" it — is excluded, defeating the
 * cheapest Sybil attack.
 */
export async function analyzeIndependence(
  agent: string,
  report: RevenueReport,
  fromLedger: number,
): Promise<IndependenceResult> {
  const revByPayer = new Map<string, bigint>();
  for (const p of report.payments) {
    revByPayer.set(p.from, (revByPayer.get(p.from) ?? 0n) + BigInt(p.amount));
  }

  const perPayer: PayerVerdict[] = [];
  const independentPayers: string[] = [];
  const circularPayers: string[] = [];
  let independentRevenue = 0n;

  for (const payer of report.payers) {
    const rev = revByPayer.get(payer) ?? 0n;
    const circular = await fundedByAgent(payer, agent, fromLedger);
    if (circular) {
      circularPayers.push(payer);
      perPayer.push({
        payer,
        revenueStroops: rev.toString(),
        independent: false,
        reason: "funded by the agent — circular (Sybil)",
      });
    } else {
      independentPayers.push(payer);
      independentRevenue += rev;
      perPayer.push({
        payer,
        revenueStroops: rev.toString(),
        independent: true,
        reason: "independent counterparty",
      });
    }
  }

  return {
    independentPayers,
    circularPayers,
    independentRevenueStroops: independentRevenue.toString(),
    perPayer,
    maxHops: MAX_HOPS,
  };
}
