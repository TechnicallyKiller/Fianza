// faucet/ — one-time testnet USDC drips for new external agents.
//
// The #1 real blocker for outside builders: there's no self-serve way to get
// testnet USDC (only the classic issuer can mint it). This wallet is funded
// once by a human from an INDEPENDENT source and then drips a small, fixed
// amount to any address that asks — once each, tracked in `faucet_claims`.
//
// Deliberately NOT any existing agent/customer wallet — see
// config.ts's DEFAULT_EXCLUDE comment and the funding-contamination trap: an
// agent funded from our own wallet cluster would get permanently flagged as
// non-independent revenue by our own anti-Sybil engine.

import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { config } from "./config.js";
import { dbConfigured, query } from "./db/index.js";

const mem = new Set<string>();

export function faucetConfigured(): boolean {
  return !!config.faucetSecret;
}

export function isValidStellarAddress(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address);
}

export async function hasClaimed(address: string): Promise<boolean> {
  if (!dbConfigured()) return mem.has(address);
  const rows = await query<{ address: string }>(
    "SELECT address FROM faucet_claims WHERE address = $1",
    [address],
  );
  return rows.length > 0;
}

async function recordClaim(address: string, amountUsdc: number, txHash: string) {
  if (!dbConfigured()) {
    mem.add(address);
    return;
  }
  await query(
    `INSERT INTO faucet_claims (address, amount_usdc, tx_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (address) DO NOTHING`,
    [address, amountUsdc, txHash],
  );
}

export interface FaucetResult {
  txHash: string;
  amountUsdc: number;
  explorerUrl: string;
}

/**
 * Send a one-time drip of testnet USDC to `address`. The recipient must
 * already exist on-chain (funded via Friendbot) AND have an open USDC
 * trustline — both are steps the recipient's own key must perform, the
 * faucet can't do it for them. Throws a clear error otherwise.
 */
export async function drip(address: string): Promise<FaucetResult> {
  if (!faucetConfigured()) {
    throw new Error("faucet not configured — FAUCET_SECRET is unset");
  }
  if (!isValidStellarAddress(address)) {
    throw new Error("not a valid Stellar address");
  }
  if (await hasClaimed(address)) {
    throw new Error("this address has already claimed the faucet");
  }

  const horizon = new Horizon.Server(config.horizonUrl);
  const faucet = Keypair.fromSecret(config.faucetSecret);
  const usdc = new Asset("USDC", config.usdcIssuer);
  const amountUsdc = config.faucetDripUsdc;

  let account;
  try {
    account = await horizon.loadAccount(faucet.publicKey());
  } catch {
    throw new Error("faucet wallet not found on-chain — has it been funded?");
  }

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: address,
        asset: usdc,
        amount: amountUsdc.toFixed(7),
      }),
    )
    .setTimeout(60)
    .build();
  tx.sign(faucet);

  let sent;
  try {
    sent = await horizon.submitTransaction(tx);
  } catch (e: any) {
    const codes = e?.response?.data?.extras?.result_codes;
    if (codes?.operations?.includes("op_no_trust")) {
      throw new Error(
        "recipient has no USDC trustline yet — establish one before requesting the faucet",
      );
    }
    if (codes?.operations?.includes("op_no_destination")) {
      throw new Error(
        "recipient account doesn't exist on-chain yet — fund it with Friendbot first",
      );
    }
    throw new Error(`faucet payment failed: ${JSON.stringify(codes ?? e.message)}`);
  }

  await recordClaim(address, amountUsdc, sent.hash);
  return {
    txHash: sent.hash,
    amountUsdc,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${sent.hash}`,
  };
}
