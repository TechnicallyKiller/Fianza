# Tael Protocol Documentation

_Extracted from https://taelprotocol.xyz/docs — the payment layer for autonomous AI agents._

## Overview

Tael is the payment layer for autonomous AI agents. It enables developers to wrap APIs, MCP tools, or data services and receive USDC payments on Stellar whenever agents utilize them, using the open x402 / HTTP-402 protocol without requiring custodial accounts or API keys.

**Core thesis:** Payment is authentication. Instead of API keys or OAuth tokens, agents prove authorization by paying for the call within the same request.

## Key Features

- **Non-custodial** — No accounts, no API keys required
- **Payment Protocol** — Open x402 / HTTP-402 standard
- **Blockchain Settlement** — USDC on Stellar (testnet & mainnet)
- **API Integration** — Monetize any HTTP endpoint with one SDK call
- **Framework Agnostic** — Works with Next.js, Hono, Bun, Deno, Cloudflare Workers

---

## Authentication: Payment as Auth

### Core Model

Rather than traditional API keys or OAuth tokens, Tael inverts the model: **the payment itself is the authentication proof**. Agents demonstrate authorization by paying for the call in the same request.

### X-402 Protocol Flow

Tael implements the HTTP 402 Payment Required standard with a four-step workflow:

#### 1. Initial Challenge
- Agent calls an endpoint **without payment credentials**
- Server responds with `402 Payment Required` and specifies its price

#### 2. Payment Proof
- Agent creates a **signed Stellar transaction** transferring the required USDC to the service's `payTo` address
- Agent retries the request with an `X-PAYMENT` header containing the payment proof

#### 3. Verification & Execution
- Server validates the payment proof's scheme and network
- Server delegates to a verifier (mock for dev, Stellar verifier for production)
- Handler executes **only after payment settles**

#### 4. Receipt & Attribution
- Response includes an `X-PAYMENT-RESPONSE` header (receipt)
- Handler receives a `receipt` parameter with settlement details (payer wallet, amount, tx hash)
- Enables usage attribution and settlement logging

### X-PAYMENT Header Structure

The `X-PAYMENT` header contains a **base64-encoded JSON envelope** with:
- `x402Version` — Protocol version
- `scheme` — Payment scheme type (e.g., "exact")
- `network` — Blockchain network ("stellar-testnet" or "stellar-mainnet")
- `payload` — Base64-encoded signed Stellar XDR transaction

### Challenge Response (402 Body)

The 402 response specifies payment requirements:
- Amount and asset details (USDC)
- Recipient address (`payTo`)
- Resource being purchased (description)
- Timeout parameters
- Payment scheme (e.g., "exact" for precise amount matching)
- `accepts` array with acceptable payment options

### Supported Networks

- **stellar-testnet** — Development environment
- **stellar-mainnet** — Production environment

---

## API Wrapping: Monetizing Endpoints

### Core Concept

Tael enables developers to **"Put a per-call price on any existing HTTP endpoint with one SDK call."** This monetization layer sits atop existing services without requiring architectural changes.

### Single Handler Setup

The foundational `tael()` function wraps a Fetch handler with payment verification:

```javascript
import { tael, createMockVerifier } from "@tael/sdk";

const handler = tael({
  price: "0.02",                    // USDC per call
  payTo: "GXXXXXX...",              // Your Stellar address
  issuer: "GXXXXX...",              // USDC issuer address
  network: "stellar-testnet",       // or "stellar-mainnet"
  verifier: createMockVerifier(),   // Mock for dev, Stellar verifier for prod
  description: "My API Service",    // Shown in 402 response
  handler: async (request, receipt) => {
    // Only runs after payment settles
    // receipt contains: { payer, amount, txHash, ... }
    return new Response("Hello, " + receipt.payer);
  }
});
```

### Reusable Configuration (Multi-Route Services)

For services with multiple priced endpoints, use `createTael()` to abstract shared settings:

```javascript
import { createTael, createMockVerifier } from "@tael/sdk";

const tael = createTael({
  payTo: "GXXXXXX...",
  issuer: "GXXXXX...",
  network: "stellar-testnet",
  verifier: createMockVerifier()
});

// Now declare only unique attributes per route
const route1 = tael.paid({
  price: "0.02",
  description: "Endpoint A",
  handler: async (request, receipt) => {
    // Implementation
  }
});

const route2 = tael.paid({
  price: "0.05",
  description: "Endpoint B",
  handler: async (request, receipt) => {
    // Implementation
  }
});
```

### Key Characteristics

- **Receipt Context** — Handler receives a `receipt` object alongside the request, enabling usage attribution
- **Pricing Format** — Prices are decimal strings representing USDC amounts (e.g., "0.02")
- **Framework Agnostic** — Wrapper produces standard `(Request) => Promise<Response>` signatures
- **Seamless Integration** — Works with Next.js route handlers, Hono, Bun, Deno, Cloudflare Workers

---

## Payment Flow: Detailed Walkthrough

### Stage 1: Challenge (Request → 402)

```
Client:  GET /api/endpoint
Server:  402 Payment Required
         {
           "price": "0.02",
           "payTo": "GXXXXXX...",
           "issuer": "GXXXXX...",
           "description": "My API Service",
           "scheme": "exact"
         }
```

### Stage 2: Payment (Client Signs & Sends)

Agent client:
1. Reads the 402 challenge
2. Creates a Stellar payment transaction (USDC transfer)
3. Signs the transaction with its keypair
4. Encodes the signed XDR as base64

```
Client:  GET /api/endpoint
         X-PAYMENT: eyJ4NDAyVmVyc2lvbiI6IjEiLCAic2NoZW1lIjogImV4YWN0IiwgLi4ufQ==
```

### Stage 3: Verification & Settlement

Server:
1. Decodes the `X-PAYMENT` header
2. Delegates to a verifier (mock or Stellar)
3. Verifier confirms the transaction on-chain (or accepts it in mock mode)
4. Proceeds to handler execution

### Stage 4: Receipt & Response

```
Server:  200 OK
         X-PAYMENT-RESPONSE: eyJ0eEhhc2giOiAiYWJjZGVmMTIzNDU2Iiw...}
         
         {
           "data": "... your response ..."
         }
```

The `X-PAYMENT-RESPONSE` header provides a receipt for the transaction.

---

## SDK Reference: @tael/sdk (Node.js)

### Installation

```bash
pnpm add @tael/sdk
# or
npm install @tael/sdk
```

The package ships as **ESM + types** with **no framework dependency**.

### Core Functions

#### `createTael(defaults): { paid(route) }`

Establishes service-wide settlement configuration and returns a `paid()` function for individual routes.

**Parameters:**
- `payTo: string` — Stellar address receiving settlements
- `issuer: string` — USDC issuer's Stellar address
- `network: "stellar-testnet" | "stellar-mainnet"` — Network to settle on
- `verifier: PaymentVerifier` — Payment verification logic

**Returns:** `{ paid: (route: TaelRoute) => FetchHandler }`

**Usage:**
```javascript
const tael = createTael({
  payTo: "GXXXXXX...",
  issuer: "GXXXXX...",
  network: "stellar-testnet",
  verifier: createMockVerifier()
});

const handler = tael.paid({
  price: "0.02",
  description: "...",
  handler: async (request, receipt) => { ... }
});
```

#### `tael(options): FetchHandler`

Single-use form returning a payment-gated Fetch handler. Best for routes without shared defaults.

**Parameters:** (See `TaelOptions` below)

**Returns:** `(Request) => Promise<Response>`

### Configuration Options (TaelOptions)

| Parameter | Type | Required | Purpose |
|-----------|------|----------|---------|
| `price` | string | ✓ | Decimal USDC amount (e.g., "0.02") |
| `payTo` | string | ✓ | Settlement recipient address |
| `issuer` | string | ✓ | USDC issuer address |
| `network` | string | ✓ | "stellar-testnet" or "stellar-mainnet" |
| `verifier` | PaymentVerifier | ✓ | Payment verification logic |
| `description` | string | — | Text shown in 402 response |
| `handler` | TaelHandler | ✓ | Processes authenticated requests |

### Verifiers

#### `createMockVerifier()`

Development/testing verifier. **Accepts any well-formed proof without chain verification.** Use in dev and tests only.

```javascript
import { createMockVerifier } from "@tael/sdk";

const verifier = createMockVerifier();
```

#### Stellar Verifier (@tael/stellar)

Production-grade verifier. **Submits and confirms transactions on the actual Stellar network** for real settlement.

```javascript
import { createStellarVerifier } from "@tael/stellar";

const verifier = createStellarVerifier();
```

### Types & Exports

**Functions:**
- `createTael(defaults)` — Create a reusable Tael instance
- `tael(options)` — Single-use payment wrapper

**Types:**
- `TaelOptions` — Full payment-gating configuration
- `TaelDefaults` — Shared configuration for multi-route services
- `TaelRoute` — Per-route configuration (price, description, handler)
- `TaelContext` — Runtime context passed to handlers
- `TaelHandler` — Type of the handler function
- `FetchHandler` — Standard Fetch handler signature
- `PaymentVerifier` — Interface for verifier implementations
- `PaymentNetwork` — Union type of supported networks
- `SettlementReceipt` — Settlement details passed to handler

**Re-exported utilities:**
- `createMockVerifier` — Dev/test verifier
- `PaymentVerifier` — Interface type
- `PaymentNetwork` — Network type
- `SettlementReceipt` — Receipt type

---

## Quickstart: Next.js Example

### 1. Install SDK

```bash
pnpm add @tael/sdk
```

### 2. Create a Route Handler

```javascript
// app/api/search/route.ts
import { createTael, createMockVerifier } from "@tael/sdk";

const tael = createTael({
  payTo: "GXXXXXX...",              // Your Stellar address
  issuer: "GXXXXX...",              // USDC issuer
  network: "stellar-testnet",
  verifier: createMockVerifier()
});

export const POST = tael.paid({
  price: "0.02",
  description: "Search API",
  handler: async (request, receipt) => {
    const query = await request.json();
    
    console.log(`Paid by: ${receipt.payer}`);
    console.log(`Amount: ${receipt.amount} USDC`);
    
    const results = await performSearch(query);
    return Response.json({ results });
  }
});
```

### 3. Agent Calls the Endpoint

```javascript
// Agent code
async function callPaidAPI() {
  // First request (no payment)
  let response = await fetch("https://yourapi.com/api/search", {
    method: "POST",
    body: JSON.stringify({ query: "..." })
  });
  
  if (response.status === 402) {
    // Read payment requirements
    const challenge = await response.json();
    
    // Create & sign payment
    const payment = await createStellarPayment({
      amount: challenge.price,
      destination: challenge.payTo,
      issuer: challenge.issuer,
      network: challenge.network
    });
    
    // Retry with payment
    response = await fetch("https://yourapi.com/api/search", {
      method: "POST",
      headers: {
        "X-PAYMENT": btoa(JSON.stringify({
          x402Version: "1",
          scheme: "exact",
          network: challenge.network,
          payload: btoa(payment.signedXdr)
        }))
      },
      body: JSON.stringify({ query: "..." })
    });
  }
  
  return await response.json();
}
```

### 4. Swap Verifier for Production

```javascript
import { createStellarVerifier } from "@tael/stellar";

const tael = createTael({
  payTo: "GXXXXXX...",
  issuer: "GXXXXX...",
  network: "stellar-mainnet",
  verifier: createStellarVerifier()  // Real settlement
});
```

---

## Framework Compatibility

Tael works seamlessly across:
- **Next.js** — Route handlers (`app/api/*`)
- **Hono** — Middleware & route handlers
- **Bun** — Fetch API handlers
- **Deno** — Standard Fetch API
- **Cloudflare Workers** — Fetch handler model

Any framework that uses the standard Fetch handler signature `(Request) => Promise<Response>` is compatible.

---

## Best Practices

1. **Consolidate Configuration** — Use `createTael()` to share settings across multiple routes rather than repeating parameters
2. **Receipt Attribution** — Use the `receipt.payer` to track which agents are calling your service
3. **Error Handling** — Verifiers may throw; wrap verifier calls in try/catch for graceful degradation
4. **Testing** — Use `createMockVerifier()` in tests; it accepts any well-formed proof
5. **Network Consistency** — Use "stellar-testnet" for development, "stellar-mainnet" for production; don't mix
6. **Pricing Strategy** — Prices are per-call decimal amounts; consider agent frequency and value delivered

---

## Links & Resources

- **Website:** https://taelprotocol.xyz
- **GitHub:** https://github.com/rahulsainlll/tael-protocol
- **Discord:** https://discord.gg/tcb6b7ZYha
- **Twitter:** https://x.com/taelprotocol

---

## Integration Notes for Fianza

Tael is a **payment layer** for APIs/services used by agents. Key integration points with Fianza:

1. **Agent Payment Source** — An agent using Fianza credit could pay for calls to Tael-wrapped services, with settlement flowing to Fianza's vault
2. **Service Revenue** — Services wrapped with Tael generate USDC revenue (on-chain, on Stellar), which can be fed into Fianza's underwriting engine
3. **x402 Composability** — Both Tael (payment protocol) and x402-paid services (like Fianza agents) use the x402 standard; natural fit for agent economy
4. **Testnet Ready** — Both platforms settle USDC on Stellar testnet for development

---

**Document Version:** 2026-07-14  
**Source:** https://taelprotocol.xyz/docs (full documentation)
