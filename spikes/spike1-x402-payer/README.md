# Spike 1 — x402 payer identity (Gate 1)

**Question:** when an x402 payment settles on Stellar, does the on-chain USDC SAC
`transfer` event record the real payer (AGENT) as `from`, or the facilitator?
Anti-Sybil logic counts distinct payers, so `from` must be the AGENT.

**Facilitator note:** the official Stellar x402 quickstart uses the **OpenZeppelin
Channels** facilitator (`https://channels.openzeppelin.com/x402/testnet`), *not* a
Coinbase facilitator, and it now **requires an API key**. The architecture is the
same one the gate assumes: the client signs auth entries, the facilitator assembles
+ submits the tx and pays the fee — so the facilitator should appear only in the
transaction-level `fee` event, never in the `transfer` event.

## Files
- `scripts/00-setup.mjs` — generate AGENT+SERVICE keypairs, friendbot fund, USDC trustlines, persist keys to `../.env`. (done)
- `server.js` — x402 paid endpoint `GET /paid` ($0.001 USDC), OZ Channels facilitator.
- `client.js` — makes EXACTLY ONE paid request from AGENT, writes `settlement.json`.
- `gate1-payer-check.mjs` — getEvents on USDC SAC, decode transfer topics, print verdict, write `gate1-result.json`.
- `run-gate1.mjs` — orchestrates server -> one request -> evidence.

## Two manual web steps (cannot be scripted)
1. Fund AGENT with testnet USDC — https://faucet.circle.com (Stellar testnet, Captcha).
   AGENT pubkey is printed by `scripts/00-setup.mjs` and stored as `AGENT_PUBLIC` in `../.env`.
2. Generate an OZ Channels **testnet** API key — https://channels.openzeppelin.com/testnet/gen
   -> paste into `OZ_API_KEY` in `../.env`.

## Run (after the two steps above)
```bash
node run-gate1.mjs
```

## Constants (testnet)
- USDC classic issuer: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
- USDC SAC (for getEvents): `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`
- transfer event layout: topics `["transfer", from, to, asset]`, data = amount (i128).
- getEvents transfer filter needs all FOUR segments `["transfer","*","*","*"]`.
