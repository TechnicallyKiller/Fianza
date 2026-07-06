// Client-safe doc navigation metadata — no filesystem access here so this can
// be imported from both server and client components. Mirrors docs/SUMMARY.md
// (kept in sync manually).

export interface DocNavItem {
  slug: string;
  title: string;
}

export interface DocNavSection {
  title: string | null;
  items: DocNavItem[];
}

export const DOCS_NAV: DocNavSection[] = [
  {
    title: null,
    items: [
      { slug: "README", title: "Getting started" },
      { slug: "what-and-why", title: "What & why" },
      { slug: "architecture", title: "Architecture" },
    ],
  },
  {
    title: "Protocol",
    items: [
      { slug: "credit-engine", title: "How the credit engine works" },
      { slug: "scoring-methodology", title: "Scoring methodology" },
      { slug: "sybil-model", title: "Sybil / independence model" },
    ],
  },
  {
    title: "Build with TrustLine",
    items: [
      { slug: "onboarding-kit", title: "Onboarding kit" },
      { slug: "sdk-reference", title: "SDK reference" },
      { slug: "contracts", title: "Contract addresses" },
    ],
  },
  {
    title: "Project",
    items: [{ slug: "roadmap", title: "Roadmap" }],
  },
];

export function allDocSlugs(): string[] {
  return DOCS_NAV.flatMap((s) => s.items.map((i) => i.slug));
}

export function getDocTitle(slug: string): string {
  for (const section of DOCS_NAV) {
    const item = section.items.find((i) => i.slug === slug);
    if (item) return item.title;
  }
  return slug;
}
