// agent-server — a tiny SSE bridge so the web UI can watch the autonomous agent
// reason and transact live, with NO terminal.
//
//   POST /run   { "request": "research XLM for me" }
//     → Server-Sent Events stream: one `data:` line per agent event
//       (thinking / tool_call / tool_result / final / error), each carrying a
//       real testnet tx hash + explorer link where money moved.
//   GET  /info  → agent address, research price, which LLM is wired.
//
// The LLM key and the agent's Stellar secret live ONLY here (server-side) —
// they never reach the browser. Run this next to the research endpoint; point
// the frontend's NEXT_PUBLIC_AGENT_SERVER at it.
import express from "express";
import { runScout, agentInfo } from "./agent-runtime.mjs";
import { llmInfo } from "../shared/agent-brain.mjs";

// Render (and most PaaS) inject PORT and expect the app to bind to it;
// AGENT_SERVER_PORT is the local-dev override.
const PORT = Number(process.env.PORT || process.env.AGENT_SERVER_PORT || 3040);
const app = express();
app.use(express.json());

// Permissive CORS (demo). The browser only ever sends a research prompt here.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.AGENT_CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/info", (_req, res) => {
  res.json({
    agent: agentInfo.address,
    researchPriceUsdc: agentInfo.researchPriceUsdc,
    trustlineApi: agentInfo.trustlineApi,
    llm: { model: llmInfo.model, baseUrl: llmInfo.baseUrl, hasKey: llmInfo.hasKey },
  });
});

app.post("/run", async (req, res) => {
  const request = String(req.body?.request || "").trim();
  if (!request) return res.status(400).json({ error: "body must be { request: string }" });

  // Open an SSE stream.
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no", // disable proxy buffering (nginx/render)
  });
  const send = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  send({ type: "start", agent: agentInfo.address, priceUsdc: agentInfo.researchPriceUsdc });

  try {
    const { final } = await runScout(request, (event) => send(event));
    send({ type: "done", final });
  } catch (e) {
    send({ type: "error", message: e instanceof Error ? e.message : String(e) });
  } finally {
    res.end();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[agent-server] listening on http://localhost:${PORT}`);
  console.log(`[agent-server] agent ${agentInfo.address}`);
  console.log(`[agent-server] LLM: ${llmInfo.model} @ ${llmInfo.baseUrl} (key: ${llmInfo.hasKey})`);
  console.log(`[agent-server] research endpoint: ${agentInfo.researchUrl} @ $${agentInfo.researchPriceUsdc}`);
});
