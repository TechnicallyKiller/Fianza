#!/usr/bin/env node
// One-command installer for the Fianza Agent SDK Claude Code skill.
//
//   npx @fianza-agents/skill
//
// Copies the bundled skill into the user's personal Claude Code skills dir
// (~/.claude/skills/fianza-agent-sdk/), where Claude Code auto-discovers it.
// No settings change needed; restart Claude Code (or /reload) to pick it up.

import { cpSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SKILL_NAME = "fianza-agent-sdk";
const src = join(__dirname, "..", "skill"); // bundled skill dir (contains SKILL.md)
const destRoot = join(homedir(), ".claude", "skills");
const dest = join(destRoot, SKILL_NAME);

function main() {
  if (!existsSync(join(src, "SKILL.md"))) {
    console.error(
      "✗ Bundled skill not found. This package appears to be corrupted — reinstall with `npx @fianza-agents/skill@latest`.",
    );
    process.exit(1);
  }

  const updating = existsSync(dest);
  mkdirSync(destRoot, { recursive: true });
  // Copy the whole skill dir (SKILL.md + any future supporting files), overwriting.
  cpSync(src, dest, { recursive: true });

  console.log("");
  console.log(`  ✓ Fianza Agent SDK skill ${updating ? "updated" : "installed"}`);
  console.log(`    → ${dest}`);
  console.log("");
  console.log("  Next:");
  console.log("    • Restart Claude Code (or run /reload) to load it");
  console.log("    • Invoke it with  /fianza-agent-sdk");
  console.log("    • Docs: https://docs.fianza.space");
  console.log("");
}

main();
