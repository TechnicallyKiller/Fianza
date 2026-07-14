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

export interface DocMeta extends DocNavItem {
  /** Section heading the doc sits under (null for the top group). */
  section: string | null;
}

/** All docs in reading order, with their section — drives prev/next paging. */
export function flatDocs(): DocMeta[] {
  return DOCS_NAV.flatMap((s) =>
    s.items.map((i) => ({ ...i, section: s.title })),
  );
}

export function docNeighbors(slug: string): {
  prev: DocMeta | null;
  next: DocMeta | null;
  section: string | null;
} {
  const flat = flatDocs();
  const i = flat.findIndex((d) => d.slug === slug);
  if (i === -1) return { prev: null, next: null, section: null };
  return {
    prev: i > 0 ? flat[i - 1] : null,
    next: i < flat.length - 1 ? flat[i + 1] : null,
    section: flat[i].section,
  };
}
