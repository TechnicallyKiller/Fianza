"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAV } from "@/lib/docs-nav";

export default function DocsSidebar() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-24 hidden h-fit w-56 flex-none space-y-6 md:block">
      {DOCS_NAV.map((section, i) => (
        <div key={i}>
          {section.title ? (
            <div className="mb-2 font-tl-mono text-xs uppercase tracking-[0.12em] text-ash/60">
              {section.title}
            </div>
          ) : null}
          <ul className="space-y-1">
            {section.items.map((item) => {
              const href = `/docs/${item.slug === "README" ? "" : item.slug}`;
              const active =
                pathname === href || (item.slug === "README" && pathname === "/docs");
              return (
                <li key={item.slug}>
                  <Link
                    href={href}
                    className={`block rounded-md px-3 py-1.5 font-tl-sans text-sm transition-colors ${
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
    </nav>
  );
}
