// DRAG-IN SNIPPET — 3 pieces to drag from here into plain.mjs.
// Full choreography in agents/demo/RECORDING.md. Short version:
//   1. Drag block A under the existing imports.
//   2. Drag block B just above the "requesting research..." console.log.
//   3. Select plain.mjs's `const res = await fetch(...)` block and drag
//      block C directly on top of it (replaces it).
// The old `if (res.status === 402)` block below can stay exactly where it
// is — harmless dead code, since a successful payWithCredit() never returns
// a 402. Nothing else in the file changes.

// ── Block A: the import ──
import { TrustLineAgent } from "@trustline-agents/agent-sdk";

// ── Block B: construct the agent (needs its own Stellar key + the API url) ──
const PRICE_USDC = Number(process.env.ANALYST_PRICE_USDC || 0.3);
const tl = new TrustLineAgent(process.env.DEMO_AGENT_SECRET, {
  apiBaseUrl: process.env.TRUSTLINE_API || "https://trustline.onrender.com",
});

// ── Block C: replaces the plain fetch() — same shape, credit is automatic ──
const res = await tl.payWithCredit(RESEARCH_URL, PRICE_USDC, {
  init: {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ asset }),
  },
});
