// db/ — Postgres (Neon) connection + schema for the persistent payment graph.
//
// The on-demand RPC indexer can only see ~24h of USDC transfer events (RPC event
// retention), which caps the moat: it can't judge how established a payer is or
// see the full funding graph. This stores every decoded transfer once, so the
// independence model can query full history (account age, out-degree, funding
// ancestry, reciprocity) from the database.

import pg from "pg";
import { config } from "../config.js";

// Neon serves over TLS; node-postgres needs ssl on unless the URL already
// negotiates it. rejectUnauthorized:false is fine for a managed provider cert.
const SSL = { rejectUnauthorized: false };

let pool: pg.Pool | null = null;

export function dbConfigured(): boolean {
  return !!config.databaseUrl;
}

export function getPool(): pg.Pool {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL not set — persistent graph is unavailable");
  }
  if (!pool) {
    pool = new pg.Pool({ connectionString: config.databaseUrl, ssl: SSL, max: 5 });
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS payments (
  event_id     TEXT PRIMARY KEY,          -- getEvents id → idempotent ingest
  from_addr    TEXT NOT NULL,
  to_addr      TEXT NOT NULL,
  amount       NUMERIC(39,0) NOT NULL,    -- i128 stroops
  ledger       INTEGER NOT NULL,
  ledger_time  TIMESTAMPTZ NOT NULL,
  tx_hash      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_to     ON payments(to_addr);
CREATE INDEX IF NOT EXISTS idx_payments_from   ON payments(from_addr);
CREATE INDEX IF NOT EXISTS idx_payments_ledger ON payments(ledger);

CREATE TABLE IF NOT EXISTS accounts (
  address           TEXT PRIMARY KEY,
  first_seen_ledger INTEGER NOT NULL,
  first_seen_time   TIMESTAMPTZ NOT NULL,
  last_seen_ledger  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  id          TEXT PRIMARY KEY,           -- e.g. 'usdc_transfers'
  last_ledger INTEGER NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

/** Create tables/indexes if they don't exist (safe to run repeatedly). */
export async function migrate(): Promise<void> {
  await getPool().query(SCHEMA);
}
