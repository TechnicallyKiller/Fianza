// Shared doc-page frame: breadcrumb + reading time + edit link on top, the
// rendered markdown, a prev/next pager, and the scroll-spy TOC rail. Server
// component — both /docs and /docs/[slug] render through this.

import Link from "next/link";
import DocContent from "@/components/DocContent";
import DocPager from "@/components/docs/DocPager";
import DocToc from "@/components/docs/DocToc";
import { docNeighbors, getDocTitle } from "@/lib/docs-nav";

const REPO = "https://github.com/TechnicallyKiller/TrustLine";

export default function DocShell({
  slug,
  markdown,
  hideHeader = false,
}: {
  slug: string;
  markdown: string;
  /** The docs index has its own hero — skip the breadcrumb row there. */
  hideHeader?: boolean;
}) {
  const { prev, next, section } = docNeighbors(slug);
  const minutes = Math.max(1, Math.round(markdown.split(/\s+/).length / 220));

  return (
    <div className="flex gap-10">
      <div className="tl-anim-fadeup min-w-0 flex-1">
        {!hideHeader ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-bone/[0.08] pb-4">
            <div className="font-tl-mono text-[11px] tracking-[0.14em] text-[#5a635e]">
              <Link href="/docs" className="transition-colors hover:text-nectar">
                DOCS
              </Link>
              {section ? (
                <>
                  {" / "}
                  <span className="text-ash">{section.toUpperCase()}</span>
                </>
              ) : null}
              {" / "}
              <span className="text-nectar">
                {getDocTitle(slug).toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-4 font-tl-mono text-[11px] text-[#5a635e]">
              <span>~{minutes} min read</span>
              <a
                href={`${REPO}/blob/main/docs/${slug}.md`}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-ion"
              >
                edit on GitHub ↗
              </a>
            </div>
          </div>
        ) : null}

        <DocContent markdown={markdown} />
        <DocPager prev={prev} next={next} />
      </div>

      <DocToc slug={slug} />
    </div>
  );
}
