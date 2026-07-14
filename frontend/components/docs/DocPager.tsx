// Prev/next pager at the bottom of every doc — walks the DOCS_NAV reading
// order (lib/docs-nav.ts docNeighbors). Server-safe, no state.

import Link from "next/link";
import type { DocMeta } from "@/lib/docs-nav";

function href(slug: string): string {
  return slug === "README" ? "/docs" : `/docs/${slug}`;
}

export default function DocPager({
  prev,
  next,
}: {
  prev: DocMeta | null;
  next: DocMeta | null;
}) {
  if (!prev && !next) return null;
  return (
    <nav className="mt-12 grid gap-3 border-t border-bone/[0.08] pt-6 sm:grid-cols-2">
      {prev ? (
        <Link
          href={href(prev.slug)}
          className="group rounded-xl border border-bone/[0.08] bg-void/50 p-4 transition-colors hover:border-nectar/40"
        >
          <div className="font-tl-mono text-[10px] tracking-[0.14em] text-[#5a635e]">
            ← PREVIOUS
          </div>
          <div className="mt-1.5 font-tl-serif text-[17px] text-bone transition-colors group-hover:text-nectar">
            {prev.title}
          </div>
        </Link>
      ) : (
        <div className="hidden sm:block" />
      )}
      {next ? (
        <Link
          href={href(next.slug)}
          className="group rounded-xl border border-bone/[0.08] bg-void/50 p-4 text-right transition-colors hover:border-ion/40"
        >
          <div className="font-tl-mono text-[10px] tracking-[0.14em] text-[#5a635e]">
            NEXT →
          </div>
          <div className="mt-1.5 font-tl-serif text-[17px] text-bone transition-colors group-hover:text-ion">
            {next.title}
          </div>
        </Link>
      ) : null}
    </nav>
  );
}
