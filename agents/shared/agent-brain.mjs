// agent-brain — a minimal, model-agnostic tool-calling loop.
//
// Unlike brain.mjs (single-shot completion), this drives a real agentic loop:
// the model is given TOOLS, it decides which to call, we execute them, feed the
// results back, and repeat until the model answers with no more tool calls.
//
// Model-agnostic on purpose: it speaks the OpenAI chat-completions + tools wire
// format, which Groq (free, default), xAI/Grok, OpenAI, Together, etc. all
// implement. Point it at any of them with env vars — no code change:
//   LLM_BASE_URL   (default https://api.groq.com/openai/v1)
//   LLM_API_KEY    (default falls back to GROQ_API_KEY)
//   LLM_MODEL      (default llama-3.3-70b-versatile)
// Grok example: LLM_BASE_URL=https://api.x.ai/v1 LLM_API_KEY=xai-... LLM_MODEL=grok-2-latest
//
// The demo defaults to FREE Groq so there's zero billing risk on stage.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

const BASE_URL = process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
const API_KEY = process.env.LLM_API_KEY || process.env.GROQ_API_KEY;
const MODEL = process.env.LLM_MODEL || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

/** One raw chat-completions call with tools. Returns the assistant message. */
async function chat(messages, tools) {
  if (!API_KEY) {
    throw new Error(
      "No LLM key: set GROQ_API_KEY (free at console.groq.com) or LLM_API_KEY for another provider.",
    );
  }
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.4,
      max_tokens: 900,
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM ${res.status} (${MODEL} @ ${BASE_URL}): ${await res.text()}`);
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  if (!msg) throw new Error(`LLM: no message in response: ${JSON.stringify(data)}`);
  return msg;
}

/**
 * Run an agentic tool-loop.
 *
 * @param {object}   o
 * @param {string}   o.system     system prompt (the agent's role + how it should think)
 * @param {string}   o.user       the user's request
 * @param {Array}    o.tools      OpenAI tool definitions ({type:'function', function:{name,description,parameters}})
 * @param {object}   o.handlers   { [toolName]: async (args) => resultObject }
 * @param {function} [o.onEvent]  called with streamed events for the UI:
 *                                {type:'thinking', text} | {type:'tool_call', name, args}
 *                                | {type:'tool_result', name, result} | {type:'final', text}
 * @param {number}   [o.maxSteps] safety cap on tool rounds (default 6)
 * @returns {Promise<{final:string, steps:Array}>}
 */
export async function runAgent({ system, user, tools, handlers, onEvent, maxSteps = 6 }) {
  const emit = onEvent || (() => {});
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const steps = [];

  for (let step = 0; step < maxSteps; step++) {
    const msg = await chat(messages, tools);
    messages.push(msg);

    // The model produced free-text reasoning alongside (or instead of) tool calls.
    if (msg.content && msg.content.trim()) {
      emit({ type: "thinking", text: msg.content.trim() });
    }

    const calls = msg.tool_calls || [];
    if (calls.length === 0) {
      // No tools requested → this is the final answer.
      const final = (msg.content || "").trim();
      emit({ type: "final", text: final });
      return { final, steps };
    }

    // Execute each requested tool and feed results back into the conversation.
    for (const call of calls) {
      const name = call.function?.name;
      let args = {};
      try {
        args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }
      emit({ type: "tool_call", name, args });

      let result;
      try {
        const handler = handlers[name];
        result = handler
          ? await handler(args)
          : { error: `unknown tool "${name}"` };
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) };
      }
      emit({ type: "tool_result", name, result });
      steps.push({ name, args, result });

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  // Hit the step cap — ask for a final wrap-up with no tools so the arc still closes.
  const wrap = await chat(
    [...messages, { role: "user", content: "Summarize what you did for the user in 2-3 sentences." }],
    [],
  );
  const final = (wrap.content || "Done.").trim();
  emit({ type: "final", text: final });
  return { final, steps };
}

export const llmInfo = { baseUrl: BASE_URL, model: MODEL, hasKey: !!API_KEY };
