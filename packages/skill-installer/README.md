# @trustline-agents/skill

One-command installer for the **TrustLine Agent SDK** Claude Code skill.

```bash
npx @trustline-agents/skill
```

This copies the skill into `~/.claude/skills/trustline-agent-sdk/`, where Claude
Code auto-discovers it. Restart Claude Code (or run `/reload`) and invoke it with
`/trustline-agent-sdk`.

## What the skill does

Teaches Claude to drive the TrustLine agent SDK — in **JavaScript/TypeScript**
(`@trustline-agents/agent-sdk`) or **Python** (`trustline-agent-sdk`) — so an AI
agent can take and repay revenue-underwritten, uncollateralized USDC credit on
Stellar: `register → underwrite → borrow → repay`, on-chain vault/credit reads,
and paying x402 APIs on credit (draw-on-402).

## Other install methods

- **curl** (no npm): `mkdir -p ~/.claude/skills/trustline-agent-sdk && curl -fsSL https://raw.githubusercontent.com/TechnicallyKiller/TrustLine/main/.claude/skills/trustline-agent-sdk/SKILL.md -o ~/.claude/skills/trustline-agent-sdk/SKILL.md`
- **plugin**: `/plugin marketplace add TechnicallyKiller/TrustLine` then `/plugin install trustline-agent-sdk@trustline`
- **clone the repo**: project-scoped — it's already in `.claude/skills/`.

## Maintainers

`skill/SKILL.md` is a **copy** of the canonical `.claude/skills/trustline-agent-sdk/SKILL.md`
at the repo root. Before publishing a new version, re-sync it:

```bash
cp ../../.claude/skills/trustline-agent-sdk/SKILL.md skill/SKILL.md
npm version patch && npm publish --access public
```
