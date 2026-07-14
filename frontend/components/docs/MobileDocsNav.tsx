"use client";

// Mobile docs navigation — the sidebar is hidden below md, so without this
// small-screen readers have no way to move between docs. A collapsible panel
// mirroring DOCS_NAV; closes itself on navigation.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { DOCS_NAV, getDocTitle } from "@/lib/docs-nav";

export default function MobileDocsNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const slug =
    pathname === "/docs" ? "README" : pathname.replace(/^\/docs\//, "");
  const current = getDocTitle(slug);

  return (
    <div className="mb-6 md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border border-bone/10 bg-void/70 px-4 py-3 text-left font-tl-sans text-sm text-bone"
      >
        <span>
          <span className="font-tl-mono text-[10px] tracking-[0.14em] text-[#5a635e]">
            DOCS ·{" "}
          </span>
          {current}
        </span>
        <ChevronDown
          size={16}
          className={`text-ash transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="mt-2 space-y-4 rounded-lg border border-bone/10 bg-void/90 p-4">
          {DOCS_NAV.map((section, i) => (
            <div key={i}>
              {section.title ? (
                <div className="mb-1.5 font-tl-mono text-[10px] uppercase tracking-[0.12em] text-ash/60">
                  {section.title}
                </div>
              ) : null}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const href =
                    item.slug === "README" ? "/docs" : `/docs/${item.slug}`;
                  const active = pathname === href;
                  return (
                    <li key={item.slug}>
                      <Link
                        href={href}
                        className={`block rounded-md px-3 py-1.5 font-tl-sans text-sm ${
                          active
                            ? "bg-nectar/15 text-nectar"
                            : "text-ash hover:bg-white/5 hover:text-bone"
                        }`}
                      >
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
