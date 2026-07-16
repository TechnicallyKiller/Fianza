import { test } from "node:test";
import assert from "node:assert/strict";
import { Account, Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { isTaelChallenge, buildTaelPaymentTx, type TaelPaymentRequirements } from "../src/tael-pay.js";

// A generic (non-Tael) x402-over-Stellar challenge, shaped like @x402/stellar's
// ExactStellarScheme expects: `asset` is a bare Soroban contract address, not
// Tael's { code, issuer } descriptor. This is the case payWithCredit must NOT
// route through the Tael path, or it will misbuild the transaction entirely.
const SOROBAN_SAC_CHALLENGE = {
  x402Version: 1,
  accepts: [
    {
      scheme: "exact",
      network: "stellar-testnet",
      maxAmountRequired: "0.02",
      payTo: "GXXXXXX",
      asset: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    },
  ],
};

// Tael's actual challenge shape (packages/payments/src/x402.ts:
// buildPaymentRequirements) — asset is a classic { code, issuer } descriptor.
const TAEL_CHALLENGE = {
  x402Version: 1,
  accepts: [
    {
      scheme: "exact",
      network: "stellar-testnet",
      maxAmountRequired: "0.05",
      payTo: "GBHCMJGPCCUSQL46GONRNM6GYZZA7AQGWE7MD6ND7W4FR266H3K5RDJ6",
      asset: { code: "USDC", issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" },
      resource: "/c/demo-capability",
      description: "demo",
    },
  ],
};

test("isTaelChallenge: recognizes Tael's classic-asset challenge shape", () => {
  assert.equal(isTaelChallenge(TAEL_CHALLENGE), true);
});

test("isTaelChallenge: rejects a generic Soroban-SAC x402 challenge", () => {
  assert.equal(isTaelChallenge(SOROBAN_SAC_CHALLENGE), false);
});

test("isTaelChallenge: rejects malformed/empty bodies", () => {
  assert.equal(isTaelChallenge(undefined), false);
  assert.equal(isTaelChallenge({}), false);
  assert.equal(isTaelChallenge({ accepts: [] }), false);
  assert.equal(isTaelChallenge({ accepts: [{ asset: "not-an-object" }] }), false);
  assert.equal(isTaelChallenge({ accepts: [{ asset: null }] }), false);
});

test("buildTaelPaymentTx: builds a classic Operation.payment with the tael memo", () => {
  const signer = Keypair.random();
  const account = new Account(signer.publicKey(), "100");
  const requirements = TAEL_CHALLENGE.accepts[0] as TaelPaymentRequirements;

  const { xdr, txHash } = buildTaelPaymentTx({ signer, account, requirements, memo: "tael" });
  assert.equal(typeof xdr, "string");
  assert.match(txHash, /^[0-9a-f]{64}$/);

  const tx = TransactionBuilder.fromXDR(xdr, "Test SDF Network ; September 2015");
  assert.equal(tx.source, signer.publicKey());
  assert.equal(tx.memo.type, "text");
  assert.equal(tx.memo.value?.toString("utf8"), "tael");

  assert.equal(tx.operations.length, 1);
  const op = tx.operations[0];
  assert.equal(op.type, "payment");
  // @ts-expect-error — narrowed by op.type check above at runtime
  assert.equal(op.destination, requirements.payTo);
  // Stellar normalizes decimal amounts to 7 places on parse.
  // @ts-expect-error
  assert.equal(op.amount, "0.0500000");
  // @ts-expect-error
  assert.equal(op.asset.getCode(), "USDC");
  // @ts-expect-error
  assert.equal(op.asset.getIssuer(), requirements.asset.issuer);
});

test("buildTaelPaymentTx: adds a second payment leg when a marketplace fee is present", () => {
  const signer = Keypair.random();
  const account = new Account(signer.publicKey(), "100");
  const requirements: TaelPaymentRequirements = {
    ...(TAEL_CHALLENGE.accepts[0] as TaelPaymentRequirements),
    fee: { payTo: Keypair.random().publicKey(), amount: "0.005" },
  };

  const { xdr } = buildTaelPaymentTx({ signer, account, requirements, memo: "tael" });
  const tx = TransactionBuilder.fromXDR(xdr, "Test SDF Network ; September 2015");

  assert.equal(tx.operations.length, 2);
  // @ts-expect-error
  assert.equal(tx.operations[1].destination, requirements.fee.payTo);
  // @ts-expect-error
  assert.equal(tx.operations[1].amount, "0.0050000");
});

test("buildTaelPaymentTx: omits the memo when none is given", () => {
  const signer = Keypair.random();
  const account = new Account(signer.publicKey(), "100");
  const requirements = TAEL_CHALLENGE.accepts[0] as TaelPaymentRequirements;

  const { xdr } = buildTaelPaymentTx({ signer, account, requirements });
  const tx = TransactionBuilder.fromXDR(xdr, "Test SDF Network ; September 2015");
  assert.equal(tx.memo.type, "none");
});
