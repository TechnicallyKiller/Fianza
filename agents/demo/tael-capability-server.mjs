// A standalone stand-in for a Tael-wrapped capability — NOT their live gateway
// (running that needs their monorepo installed + Postgres, see
// tael-protocol/apps/api). Instead this reimplements, verbatim, their real
// verification algorithm and 402/X-PAYMENT wire format so a TrustLine agent
// paying this endpoint is doing exactly what it would do against a real Tael
// capability — same challenge shape, same classic Operation.payment check,
// same on-chain settlement.
//
// Traced line-for-line against rahulsainlll/tael-protocol:
//   - 402 challenge shape:     packages/payments/src/x402.ts (buildPaymentRequirements)
//   - X-PAYMENT encode/decode: packages/payments/src/x402.ts (decodePaymentHeader)
//   - payment verification:    packages/stellar/src/payment-verify.ts (verifyTransactionPayments)
//   - settlement + receipt:    apps/api/src/container.ts (createStellarVerifier)
//   - memo convention:         packages/stellar/src/pay.ts (TAEL_MEMO = "tael")
import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TransactionBuilder, Horizon, Memo } from "@stellar/stellar-sdk";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const PORT = Number(process.env.TAEL_DEMO_PORT || 3099);
const PRICE_USDC = process.env.TAEL_DEMO_PRICE_USDC || "0.05";
const NETWORK = "stellar-testnet";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const USDC_ISSUER =
  process.env.TAEL_USDC_ISSUER || "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const TAEL_MEMO = "tael";
// Who this capability pays out to (the "builder"). Reuses a funded demo wallet.
const PAY_TO = process.env.SCOUT_WALLET_PUBLIC;
if (!PAY_TO) throw new Error("Set SCOUT_WALLET_PUBLIC in agents/.env (payee for this capability)");

const server = new Horizon.Server(HORIZON_URL);

/** packages/payments/src/x402.ts: buildPaymentRequirements */
function buildPaymentRequired(resource) {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        maxAmountRequired: PRICE_USDC,
        payTo: PAY_TO,
        asset: { code: "USDC", issuer: USDC_ISSUER },
        resource,
        description: "Tael-shaped demo capability (TrustLine integration proof)",
        maxTimeoutSeconds: 60,
      },
    ],
  };
}

/** packages/payments/src/x402.ts: decodePaymentHeader */
function decodePaymentHeader(headerValue) {
  if (!headerValue) throw new Error("Missing X-PAYMENT header");
  const json = JSON.parse(Buffer.from(headerValue, "base64").toString("utf8"));
  if (json.x402Version !== 1 || json.scheme !== "exact" || json.network !== NETWORK) {
    throw new Error("Unsupported x402 payload");
  }
  if (typeof json.payload?.transaction !== "string") throw new Error("Missing transaction XDR");
  return json;
}

/**
 * packages/stellar/src/payment-verify.ts: verifyTransactionPayments, reimplemented
 * verbatim — classic Operation.payment check, USDC code+issuer match, minimum
 * amount to `payTo`. Real settlement (no mock): submits to testnet Horizon.
 */
async function verifyAndSettle(signedXdr, requirements) {
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const inner = "innerTransaction" in tx ? tx.innerTransaction : tx;
  const payer = inner.source;

  const usdcPayments = inner.operations
    .filter((op) => op.type === "payment")
    .filter(
      (op) => !op.asset.isNative() && op.asset.getCode() === "USDC" && op.asset.getIssuer() === requirements.asset.issuer,
    )
    .map((op) => ({ destination: op.destination, amount: Number(op.amount) }));

  const ok = usdcPayments.some(
    (p) => p.destination === requirements.payTo && p.amount >= Number(requirements.maxAmountRequired),
  );
  if (!ok) {
    throw new Error(`Missing USDC payment of >= ${requirements.maxAmountRequired} to ${requirements.payTo}`);
  }

  // Tael's memo attribution convention: settlement must carry the "tael" text memo.
  const memo = inner.memo;
  if (memo?.type !== "text" || Buffer.from(memo.value).toString("utf8") !== TAEL_MEMO) {
    throw new Error(`Missing or wrong memo — expected text memo "${TAEL_MEMO}"`);
  }

  const result = await server.submitTransaction(inner);
  return {
    txHash: result.hash,
    network: NETWORK,
    settledAt: new Date().toISOString(),
    payer,
    amount: requirements.maxAmountRequired,
    asset: "USDC",
  };
}

const app = express();
app.use(express.json());

app.post("/c/demo-capability", async (req, res) => {
  const resource = req.path;
  const requirements = buildPaymentRequired(resource).accepts[0];

  const header = req.get("X-PAYMENT");
  if (!header) {
    return res.status(402).json(buildPaymentRequired(resource));
  }

  let receipt;
  try {
    const payload = decodePaymentHeader(header);
    receipt = await verifyAndSettle(payload.payload.transaction, requirements);
  } catch (e) {
    return res.status(402).json({ ...buildPaymentRequired(resource), error: e.message });
  }

  res.set(
    "X-PAYMENT-RESPONSE",
    Buffer.from(JSON.stringify(receipt), "utf8").toString("base64"),
  );
  console.log(`[tael-capability] settled ${receipt.amount} USDC from ${receipt.payer}, tx ${receipt.txHash}`);
  res.json({
    result: `Hello, ${receipt.payer.slice(0, 6)}… — this response cost you ${PRICE_USDC} USDC.`,
    receipt,
  });
});

app.listen(PORT, () => {
  console.log(`[tael-capability] listening on :${PORT} — POST /c/demo-capability, price ${PRICE_USDC} USDC`);
  console.log(`[tael-capability] payTo=${PAY_TO}`);
});
