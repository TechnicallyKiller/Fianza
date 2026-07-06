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
            <div className="mb-2 font-mono text-xs uppercase tracking-[0.12em] text-on-surface-variant/50">
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
                    className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-primary-container/15 text-primary"
                        : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
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
