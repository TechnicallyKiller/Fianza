// indexer/ — x402 USDC revenue indexer.
//
// Reads SAC `transfer` events from the USDC testnet contract via Soroban
// `getEvents` and sums what each agent has EARNED (transfers where `to` == the
// agent), grouping by distinct payer (`from`) so the anti-Sybil minimum-
// counterparty rule can be applied. Lifts the validated decode + four-segment
// topic filter from spikes/spike1-x402-payer/gate1-payer-check.mjs.
//
// GOTCHAS honoured here:
//  - the SAC transfer filter needs FOUR topic segments ["transfer","*","*","*"]
//    or the RPC silently returns nothing.
//  - transfer event topics are ["transfer", from, to, asset], data = amount.
//  - the facilitator submitter + fee sponsor only ever appear as tx source /
//    fee event, never as a real payer — they're on config.excludeAddresses and
//    are never counted as a counterparty.

import { rpc, xdr, scValToNative } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { rpcErrorMessage } from "../rpc-error.js";

const server = new rpc.Server(config.sorobanRpcUrl, { allowHttp: false });

/** Decode a getEvents topic/value, which may be a base64 XDR string or ScVal. */
function native(t: unknown): unknown {
  const sv = typeof t === "string" ? xdr.ScVal.fromXDR(t, "base64") : (t as xdr.ScVal);
  return scValToNative(sv);
}

export interface Payment {
  from: string;
  amount: string; // USDC stroops (7 decimals)
  ledger: number;
  txHash: string;
}

export interface RevenueReport {
  agent: string;
  /** Total USDC earned in the window, in stroops (7 decimals), as a string. */
  totalRevenueStroops: string;
  /** Human USDC (totalRevenueStroops / 1e7). */
  totalRevenueUsdc: number;
  /** Number of distinct, non-excluded payers (counterparties). */
  distinctPayers: number;
  payers: string[];
  payments: Payment[];
  windowFromLedger: number;
  windowToLedger: number;
}

export interface IndexOptions {
  /** Explicit start ledger (e.g. just before a known payment). */
  fromLedger?: number;
  /** Ledgers back from latest to scan when fromLedger is not given. */
  lookback?: number;
}

/**
 * Index an agent's x402 revenue over a ledger window.
 *
 * The shared USDC testnet SAC is high-traffic, so prefer a narrow window via
 * `fromLedger` near a known payment. The start ledger is clamped into the RPC's
 * current retention range (parsed from its error if we overshoot).
 *
 * @param agent  the earning agent's Stellar address (the transfer recipient)
 */
export async function indexRevenue(
  agent: string,
  opts: IndexOptions = {},
): Promise<RevenueReport> {
  const latest = await server.getLatestLedger();
  const toLedger = latest.sequence;
  const lookback = opts.lookback ?? 1_000;
  let startLedger = opts.fromLedger ?? Math.max(1, toLedger - lookback);

  const transferSym = xdr.ScVal.scvSymbol("transfer").toXDR("base64");
  const filters = [
    {
      type: "contract" as const,
      contractIds: [config.usdcSac],
      topics: [[transferSym, "*", "*", "*"]],
    },
  ];
  const baseParams: rpc.Server.GetEventsRequest = { startLedger, filters, limit: 200 };

  const exclude = new Set(config.excludeAddresses);
  const payments: Payment[] = [];
  const payerSet = new Set<string>();
  let total = 0n;

  // Clamp the start ledger into the RPC's retention window if we overshot.
  async function firstPage() {
    try {
      return await server.getEvents(baseParams);
    } catch (e) {
      const msg = rpcErrorMessage(e);
      const m = /ledger range:\s*(\d+)\s*-\s*(\d+)/.exec(msg);
      if (m) {
        const oldest = Number(m[1]);
        const newest = Number(m[2]);
        startLedger = Math.min(Math.max(startLedger, oldest), newest);
        return server.getEvents({ startLedger, filters, limit: 200 });
      }
      throw e;
    }
  }

  let cursor: string | undefined;
  for (let page = 0; page < 50; page++) {
    const resp = cursor
      ? await server.getEvents({ filters, limit: 200, cursor } as rpc.Server.GetEventsRequest)
      : await firstPage();
    const events = resp.events ?? [];

    for (const e of events) {
      const topics = (e.topic as unknown[]).map(native);
      const [, from, to] = topics as [string, string, string, string];
      if (to !== agent) continue; // revenue = what the agent received
      if (from === agent || exclude.has(from)) continue; // self-pay / facilitator

      const amount = BigInt(native(e.value) as bigint | number | string);
      total += amount;
      payerSet.add(from);
      payments.push({
        from,
        amount: amount.toString(),
        ledger: e.ledger,
        txHash: e.txHash,
      });
    }

    cursor = resp.cursor;
    if (!cursor || events.length === 0) break;
  }

  return {
    agent,
    totalRevenueStroops: total.toString(),
    totalRevenueUsdc: Number(total) / 10 ** config.usdcDecimals,
    distinctPayers: payerSet.size,
    payers: [...payerSet],
    payments,
    windowFromLedger: startLedger,
    windowToLedger: toLedger,
  };
}
