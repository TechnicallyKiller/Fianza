// waitlist/ — early-access signup capture for the landing form.
//
// Persists to Postgres (Neon) when DATABASE_URL is set, with an in-memory
// fallback so local/dev runs work without a database. Idempotent on email.

import { dbConfigured, query } from "./db/index.js";

const mem = new Set<string>();

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

// Minimal, permissive email shape check — real validation is delivery.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(normalize(email));
}

/** Add an email to the waitlist. Returns whether it was newly added. */
export async function addToWaitlist(
  email: string,
  source?: string,
): Promise<{ added: boolean }> {
  const e = normalize(email);
  if (!dbConfigured()) {
    const isNew = !mem.has(e);
    mem.add(e);
    return { added: isNew };
  }
  const rows = await query<{ email: string }>(
    `INSERT INTO waitlist (email, source) VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING
     RETURNING email`,
    [e, source ?? null],
  );
  return { added: rows.length > 0 };
}

export async function waitlistCount(): Promise<number> {
  if (!dbConfigured()) return mem.size;
  const rows = await query<{ n: string }>("SELECT count(*)::text AS n FROM waitlist");
  return Number(rows[0]?.n ?? 0);
}
