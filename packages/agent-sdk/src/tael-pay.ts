// Tael-compatible x402 payment client.
//
// Tael (rahulsainlll/tael-protocol) speaks x402 over Stellar, but NOT the same
// payload as @x402/stellar's ExactStellarScheme (the generic scheme this SDK's
// payWithCredit uses by default). The two are incompatible despite both being
// "x402 on Stellar":
//
//   @x402/stellar  → requirements.asset is a Soroban CONTRACT ADDRESS; it signs
//                    an AssembledTransaction invoking that SAC's `transfer`.
//   Tael           → requirements.asset is a CLASSIC asset descriptor
//                    { code: "USDC", issuer }; its verifier
//                    (verifyTransactionPayments) only recognizes a classic
//                    Operation.payment, and settles by submitting the signed
//                    XDR to Horizon itself (the payer only signs, never
//                    broadcasts).
//
// Both happen to share the SAME outer envelope shape
// ({ x402Version, scheme, network, payload: { transaction } }), so this module
// only needs to build the transaction contents differently, not reinvent the
// header/response plumbing.
//
// This is a plain, self-contained implementation of Tael's documented
// PaymentRequirements/PaymentPayload schema (packages/payments/src/x402.ts in
// their repo) — it doesn't depend on @x402/core's generic scheme registry,
// since Tael's protocol is fully specified and narrow enough not to need it.

import {
  Account,
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Memo,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const X402_VERSION = 1;

export interface TaelPaymentFee {
  payTo: string;
  amount: string; // decimal USDC string
}

/** The `accepts[0]` entry from a Tael 402 challenge body. */
export interface TaelPaymentRequirements {
  scheme: "exact";
  network: "stellar-testnet" | "stellar-mainnet";
  maxAmountRequired: string; // decimal USDC string, the builder's net share
  payTo: string;
  asset: { code: "USDC"; issuer: string };
  fee?: TaelPaymentFee;
  resource: string;
  description?: string;
  maxTimeoutSeconds?: number;
}

/** A Tael 402 response body: `{ x402Version, accepts: [...], error? }`. */
export interface TaelPaymentRequired {
  x402Version: number;
  accepts: TaelPaymentRequirements[];
  error?: string;
}

/** True if a 402 body looks like Tael's classic-asset challenge, not a generic
 * Soroban-SAC x402 challenge (where `asset` is a bare contract address string). */
export function isTaelChallenge(body: unknown): body is TaelPaymentRequired {
  const b = body as Partial<TaelPaymentRequired> | undefined;
  const req = b?.accepts?.[0];
  return (
    !!req &&
    typeof req.asset === "object" &&
    req.asset !== null &&
    "code" in req.asset &&
    "issuer" in req.asset
  );
}

const HORIZON_BY_NETWORK: Record<TaelPaymentRequirements["network"], string> = {
  "stellar-testnet": "https://horizon-testnet.stellar.org",
  "stellar-mainnet": "https://horizon.stellar.org",
};
const PASSPHRASE_BY_NETWORK: Record<TaelPaymentRequirements["network"], string> = {
  "stellar-testnet": "Test SDF Network ; September 2015",
  "stellar-mainnet": "Public Global Stellar Network ; September 2015",
};

/**
 * Build and sign the classic Stellar payment transaction Tael's verifier
 * expects, given the paying account's current sequence number. Split out from
 * {@link buildTaelPaymentHeader} so tests can exercise the actual tx
 * construction (memo, operations, amounts) without a network round-trip via
 * `loadAccount`.
 *
 * Mirrors `buildSignedPayment` from `tael-protocol/packages/stellar/src/pay.ts`
 * and the `X-PAYMENT` shape built in
 * `.../apps/dashboard/features/agents/run-capability.ts`, so a transaction
 * built here verifies against Tael's real, unmodified verifier.
 */
export function buildTaelPaymentTx(args: {
  signer: Keypair;
  account: Account | Horizon.AccountResponse;
  requirements: TaelPaymentRequirements;
  /** Stellar text memo Tael expects on settlement (default: "tael"). */
  memo?: string;
}): { xdr: string; txHash: string } {
  const { requirements: req } = args;
  const usdc = new Asset(req.asset.code, req.asset.issuer);

  const builder = new TransactionBuilder(args.account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE_BY_NETWORK[req.network],
  });
  if (args.memo) {
    builder.addMemo(Memo.text(args.memo));
  }
  builder.addOperation(
    Operation.payment({ destination: req.payTo, asset: usdc, amount: req.maxAmountRequired }),
  );
  if (req.fee) {
    builder.addOperation(
      Operation.payment({ destination: req.fee.payTo, asset: usdc, amount: req.fee.amount }),
    );
  }
  const tx = builder.setTimeout(req.maxTimeoutSeconds ?? 60).build();
  tx.sign(args.signer);
  return { xdr: tx.toXDR(), txHash: tx.hash().toString("hex") };
}

/**
 * Build and sign the classic Stellar payment Tael's verifier expects, then
 * encode it as a Tael `X-PAYMENT` header value (base64 JSON envelope).
 * Loads the paying account's live sequence number from Horizon first.
 */
export async function buildTaelPaymentHeader(args: {
  secret: string;
  requirements: TaelPaymentRequirements;
  /** Stellar text memo Tael expects on settlement (default: "tael"). */
  memo?: string;
  horizonUrl?: string;
}): Promise<string> {
  const { requirements: req } = args;
  const signer = Keypair.fromSecret(args.secret);
  const horizonUrl = args.horizonUrl ?? HORIZON_BY_NETWORK[req.network];
  const server = new Horizon.Server(horizonUrl);

  const account = await server.loadAccount(signer.publicKey());
  const { xdr } = buildTaelPaymentTx({ signer, account, requirements: req, memo: args.memo });

  const payload = {
    x402Version: X402_VERSION,
    scheme: req.scheme,
    network: req.network,
    payload: { transaction: xdr },
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

/**
 * Pay a Tael-wrapped x402 resource given its already-fetched 402 challenge
 * body (see `isTaelChallenge` — callers probe once and branch on the result,
 * so this doesn't re-probe): sign the classic payment Tael's verifier
 * requires and retry with `X-PAYMENT`. Returns the settled `Response`.
 */
export async function payTael(
  url: string,
  challenge: TaelPaymentRequired,
  args: { secret: string; memo?: string; init?: RequestInit },
): Promise<Response> {
  const requirements = challenge.accepts[0]!;

  const xPayment = await buildTaelPaymentHeader({
    secret: args.secret,
    requirements,
    memo: args.memo ?? "tael",
  });

  return fetch(url, {
    ...args.init,
    headers: { ...args.init?.headers, "X-PAYMENT": xPayment },
  });
}
