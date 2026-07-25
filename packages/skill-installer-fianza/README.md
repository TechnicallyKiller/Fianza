# @fianza/skill

One-command installer for the **Fianza Agent SDK** Claude Code skill.

```bash
npx @fianza/skill
```

This copies the skill into `~/.claude/skills/fianza-agent-sdk/`, where Claude
Code auto-discovers it. Restart Claude Code (or run `/reload`) and invoke it with
`/fianza-agent-sdk`.

## What the skill does

Teaches Claude to drive the Fianza agent SDK — in **JavaScript/TypeScript**
(`@fianza/agent-sdk`) or **Python** (`fianza-agent-sdk`) — so an AI
agent can take and repay revenue-underwritten, uncollateralized USDC credit on
Stellar: `register → underwrite → borrow → repay`, on-chain vault/credit reads,
and paying x402 APIs on credit (draw-on-402).

## Other install methods

- **curl** (no npm): `mkdir -p ~/.claude/skills/fianza-agent-sdk && curl -fsSL https://raw.githubusercontent.com/TechnicallyKiller/TrustLine/main/.claude/skills/fianza-agent-sdk/SKILL.md -o ~/.claude/skills/fianza-agent-sdk/SKILL.md`
- **plugin**: `/plugin marketplace add TechnicallyKiller/TrustLine` then `/plugin install fianza-agent-sdk@trustline`
- **clone the repo**: project-scoped — it's already in `.claude/skills/`.

## Maintainers

`skill/SKILL.md` is a **copy** of the canonical `.claude/skills/fianza-agent-sdk/SKILL.md`
at the repo root. Before publishing a new version, re-sync it:

```bash
cp ../../.claude/skills/fianza-agent-sdk/SKILL.md skill/SKILL.md
npm version patch && npm publish --access public
```
