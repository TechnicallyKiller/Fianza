"use client";

// "On this page" right rail — scans the rendered .doc-content for h2/h3 after
// mount (headings get ids from DocContent's slugger), and scroll-spies the
// active section with an IntersectionObserver. Hidden below xl; renders
// nothing for short docs.

import { useEffect, useState } from "react";

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export default function DocToc({ slug }: { slug: string }) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    const headings = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".doc-content h2[id], .doc-content h3[id]",
      ),
    );
    setItems(
      headings.map((h) => ({
        id: h.id,
        text: h.textContent ?? "",
        level: h.tagName === "H2" ? 2 : 3,
      })),
    );
    setActive("");
    if (typeof IntersectionObserver === "undefined" || headings.length === 0)
      return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActive(e.target.id);
            break;
          }
        }
      },
      { rootMargin: "-90px 0px -70% 0px" },
    );
    headings.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [slug]);

  if (items.length < 2) return null;

  return (
    <nav className="sticky top-24 hidden h-fit max-h-[calc(100vh-8rem)] w-52 flex-none overflow-y-auto xl:block">
      <div className="mb-3 font-tl-mono text-[10px] tracking-[0.16em] text-[#5a635e]">
        ON THIS PAGE
      </div>
      <ul className="space-y-0.5">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className={`block border-l-2 py-1 text-[12.5px] leading-snug transition-colors ${
                it.level === 3 ? "pl-6" : "pl-3"
              } ${
                active === it.id
                  ? "border-nectar text-nectar"
                  : "border-bone/[0.08] text-ash hover:border-bone/25 hover:text-bone"
              }`}
            >
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
