import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@stellar/stellar-sdk";
import {
  toStroops,
  fromStroops,
  assertPositiveAmount,
  isValidStellarAddress,
  assertValidAddress,
  creditShortfallUsdc,
} from "../src/util.js";
import { ValidationError, MaxDrawExceededError } from "../src/errors.js";

test("toStroops: USDC → stroops", () => {
  assert.equal(toStroops(1), 10_000_000n);
  assert.equal(toStroops(0.3), 3_000_000n);
  assert.equal(toStroops(0.1455882), 1_455_882n);
  assert.equal(toStroops(5n), 5n); // bigint passes through
});

test("toStroops: rounds to nearest stroop, no float drift", () => {
  // 0.1 + 0.2 = 0.30000000000000004 in float; must still land on 3_000_000.
  assert.equal(toStroops(0.1 + 0.2), 3_000_000n);
});

test("toStroops: rejects non-finite input", () => {
  assert.throws(() => toStroops(NaN), ValidationError);
  assert.throws(() => toStroops(Infinity), ValidationError);
});

test("fromStroops: stroops → USDC (bigint, string, number)", () => {
  assert.equal(fromStroops(10_000_000n), 1);
  assert.equal(fromStroops("1455882"), 0.1455882);
  assert.equal(fromStroops(3_000_000), 0.3);
});

test("round-trip toStroops/fromStroops is stable", () => {
  for (const v of [0.05, 0.3, 1.5, 2.3529411]) {
    assert.equal(fromStroops(toStroops(v)), v);
  }
});

test("assertPositiveAmount: accepts positives, rejects <= 0 and non-finite", () => {
  assert.doesNotThrow(() => assertPositiveAmount(0.01));
  assert.throws(() => assertPositiveAmount(0), ValidationError);
  assert.throws(() => assertPositiveAmount(-1), ValidationError);
  assert.throws(() => assertPositiveAmount(NaN), ValidationError);
  // @ts-expect-error — exercising runtime guard against bad types
  assert.throws(() => assertPositiveAmount("1"), ValidationError);
});

test("isValidStellarAddress / assertValidAddress", () => {
  const good = Keypair.random().publicKey();
  assert.equal(isValidStellarAddress(good), true);
  assert.equal(isValidStellarAddress("not-an-address"), false);
  assert.equal(isValidStellarAddress(""), false);
  assert.doesNotThrow(() => assertValidAddress(good));
  assert.throws(() => assertValidAddress("nope", "agentAddress"), ValidationError);
});

test("creditShortfallUsdc: balance covers price → 0", () => {
  assert.equal(creditShortfallUsdc(1, 0.3), 0);
  assert.equal(creditShortfallUsdc(0.3, 0.3), 0); // exactly enough
});

test("creditShortfallUsdc: shortfall rounds UP to the cent", () => {
  assert.equal(creditShortfallUsdc(0, 0.3), 0.3);
  assert.equal(creditShortfallUsdc(0.1, 0.3), 0.2);
  // 0.234 shortfall must round up to 0.24 so the draw is never short.
  assert.equal(creditShortfallUsdc(0.066, 0.3), 0.24);
});

test("creditShortfallUsdc: maxDraw cap enforced", () => {
  assert.doesNotThrow(() => creditShortfallUsdc(0, 0.3, 0.5));
  assert.throws(() => creditShortfallUsdc(0, 0.3, 0.1), MaxDrawExceededError);
  try {
    creditShortfallUsdc(0, 0.3, 0.1);
  } catch (e) {
    assert.ok(e instanceof MaxDrawExceededError);
    assert.equal(e.need, 0.3);
    assert.equal(e.maxDraw, 0.1);
  }
});

test("creditShortfallUsdc: rejects invalid inputs", () => {
  assert.throws(() => creditShortfallUsdc(1, 0), ValidationError); // price <= 0
  assert.throws(() => creditShortfallUsdc(-1, 0.3), ValidationError); // negative balance
  assert.throws(() => creditShortfallUsdc(NaN, 0.3), ValidationError);
});
