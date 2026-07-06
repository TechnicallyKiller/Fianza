#!/usr/bin/env node
// Syncs docs/*.md (the source of truth, edited directly) into
// frontend/content/docs (what the /docs site actually reads at request time).
//
// Runs automatically before `dev` and `build` (see package.json's "predev"/
// "prebuild") so the two can never silently drift apart. Plain Node fs, no
// shell dependency, so it works the same on Windows/WSL/CI.

import { readdirSync, mkdirSync, copyFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "..", "..", "docs");
const DEST = join(here, "..", "content", "docs");

mkdirSync(DEST, { recursive: true });

const files = readdirSync(SRC).filter((f) => f.endsWith(".md"));
let changed = 0;
for (const file of files) {
  const srcPath = join(SRC, file);
  const destPath = join(DEST, file);
  const srcContent = readFileSync(srcPath, "utf8");
  let destContent = null;
  try {
    destContent = readFileSync(destPath, "utf8");
  } catch {
    /* dest doesn't exist yet */
  }
  if (destContent !== srcContent) {
    copyFileSync(srcPath, destPath);
    changed++;
  }
}

if (changed > 0) {
  console.log(`[sync-docs] synced ${changed}/${files.length} doc file(s) from ../docs`);
} else {
  console.log(`[sync-docs] up to date (${files.length} doc files)`);
}
