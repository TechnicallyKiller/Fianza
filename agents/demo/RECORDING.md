# Recording the "drag and drop" SDK demo

Goal: show, live and un-faked, that adding TrustLine credit to an existing
agent is a literal drag-and-drop of ~3 blocks — not a rewrite.

## Setup (before you hit record)

1. Open the repo in VS Code. Open two files in a **split editor** (right-click
   a tab → "Split Right", or drag a tab to the right half of the window):
   - Left pane: `agents/demo/plain.mjs`
   - Right pane: `agents/demo/snippet-add-credit.mjs`
2. Zoom in (`Cmd/Ctrl` + `+` a few times) so text is readable on camera —
   aim for ~18-20px editor font.
3. In a **third terminal pane** (bottom, out of the main frame), start Analyst:
   ```bash
   cd ~/stellar/agents/analyst && ANALYST_PORT=3022 ANALYST_PRICE_USDC=0.10 node server.mjs
   ```
4. Have a second terminal tab ready (not yet focused) with:
   ```bash
   cd ~/stellar/agents/demo && RESEARCH_URL=http://localhost:3022/research node plain.mjs BTC
   ```

## The recording, in one continuous take

**0:00 — Run the plain agent.** Switch to the terminal, run the command from
step 4 above. It dies with `402 Payment Required`. Let it sit for a beat.

**0:10 — Cut to the editor.** Left pane shows `plain.mjs` mid-file, right pane
shows the snippet. Point out (cursor or voiceover): "three things to add."

**0:15 — Drag block A.** Click and hold on the `import { TrustLineAgent }...`
line in the snippet pane, drag it across into the left pane, drop it right
under `plain.mjs`'s existing imports (after the `dotenv.config(...)` line).
VS Code inserts the text at the drop point — this is a real, native VS Code
editor feature, not a trick.

**0:20 — Drag block B.** Select the `const PRICE_USDC = ...` through the
closing `});` of the `TrustLineAgent` construction (5 lines) in the snippet
pane, drag it into the left pane, drop it just above
`console.log(`[demo-agent] requesting research...`)`.

**0:28 — Swap block C.** In the left pane, select the whole
`const res = await fetch(RESEARCH_URL, { ... });` block (5 lines). Delete it.
Then drag the `const res = await tl.payWithCredit(...)` block from the
snippet pane into the same spot.

**0:35 — Save (`Cmd/Ctrl+S`).** The file now behaves like `with-credit.mjs`.

**0:38 — Run it.** Switch to the terminal, run:
```bash
RESEARCH_URL=http://localhost:3022/research ANALYST_PRICE_USDC=0.10 node plain.mjs BTC
```
Same paywall, same agent — now it prints `paid via credit line, got
research:` and real content.

**Total: ~45 seconds**, all real, nothing faked — every keystroke and every
terminal line is genuine output against live testnet infrastructure.

## Why this is safe to claim as "just drag and drop"

- The three additions are a straight copy-paste-shaped edit — no logic
  changes elsewhere in the file.
- The pre-existing `if (res.status === 402) { ... }` block below can be left
  completely alone. It becomes dead code (a successful `payWithCredit()`
  never returns a 402 — it borrows *before* making the request), but it
  doesn't need to be deleted for the file to work correctly. One less thing
  to explain on camera.
- If you'd rather not do live drag-and-drop (mouse drags can look janky on
  screen recordings, especially at 1x speed), the fallback is identical in
  spirit: use a code-typing animation tool (e.g. VS Code's own macro
  recorder, or a screen-recording tool with speed ramping) to show the same
  3 blocks appearing in the same order. The important thing for credibility
  is that the end state runs live afterward — don't fake the "it works" part.

## If you need a clean re-run

`plain.mjs` and `with-credit.mjs` are untouched by this — they're the
reference files. Do your dragging into a scratch copy
(`cp plain.mjs scratch.mjs`, drag into `scratch.mjs`) if you want to record
multiple takes without re-diffing plain.mjs each time.
