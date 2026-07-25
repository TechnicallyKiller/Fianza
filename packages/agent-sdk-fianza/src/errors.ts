// Typed error hierarchy so callers can catch specific failures instead of
// string-matching generic Errors. All extend FianzaError, so
// `catch (e) { if (e instanceof FianzaError) ... }` covers everything.

export class FianzaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FianzaError";
  }
}

/** Bad input passed to the SDK (invalid amount, malformed address, etc.). */
export class ValidationError extends FianzaError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** A call to the Fianza backend API returned a non-2xx status. */
export class ApiError extends FianzaError {
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
export class TxError extends FianzaError {
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
export class MaxDrawExceededError extends FianzaError {
  constructor(
    readonly need: number,
    readonly maxDraw: number,
  ) {
    super(`x402 shortfall ${need} USDC exceeds maxDraw ${maxDraw} USDC`);
    this.name = "MaxDrawExceededError";
  }
}
