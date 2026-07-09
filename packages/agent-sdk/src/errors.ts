// Typed error hierarchy so callers can catch specific failures instead of
// string-matching generic Errors. All extend TrustLineError, so
// `catch (e) { if (e instanceof TrustLineError) ... }` covers everything.

export class TrustLineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrustLineError";
  }
}

/** Bad input passed to the SDK (invalid amount, malformed address, etc.). */
export class ValidationError extends TrustLineError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** A call to the TrustLine backend API returned a non-2xx status. */
export class ApiError extends TrustLineError {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly body?: unknown,
  ) {
    super(`${method} ${path} → ${status}`);
    this.name = "ApiError";
  }
}

/** An on-chain transaction failed to simulate, submit, or confirm. */
export class TxError extends TrustLineError {
  constructor(
    message: string,
    readonly contractMethod: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "TxError";
  }
}

/** payWithCredit would have to draw more than the caller's `maxDraw` cap. */
export class MaxDrawExceededError extends TrustLineError {
  constructor(
    readonly need: number,
    readonly maxDraw: number,
  ) {
    super(`x402 shortfall ${need} USDC exceeds maxDraw ${maxDraw} USDC`);
    this.name = "MaxDrawExceededError";
  }
}
