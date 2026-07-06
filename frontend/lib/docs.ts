import fs from "node:fs";
import path from "node:path";
import { allDocSlugs } from "./docs-nav";

// Server-only: reads doc markdown from disk. Never import this from a
// "use client" component — it pulls in Node's fs/path.
export { DOCS_NAV, allDocSlugs, getDocTitle } from "./docs-nav";

// Docs content lives in frontend/content/docs (copied from the repo-root
// /docs so it deploys regardless of Vercel's configured root directory).
const DOCS_DIR = path.join(process.cwd(), "content", "docs");
const VALID_SLUGS = new Set(allDocSlugs());

export function readDoc(slug: string): string {
  if (!VALID_SLUGS.has(slug)) throw new Error("invalid doc slug");
  const filePath = path.join(DOCS_DIR, `${slug}.md`);
  return fs.readFileSync(filePath, "utf8");
}
