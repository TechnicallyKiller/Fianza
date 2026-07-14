import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { allDocSlugs } from "@/lib/docs-nav";
import Mermaid from "@/components/Mermaid";
import CodeBlock from "@/components/docs/CodeBlock";

const REPO = "https://github.com/TechnicallyKiller/TrustLine";
const DOC_SLUGS = new Set(allDocSlugs());

// Doc source files link to each other as relative `.md` paths (so they also
// work standalone on GitHub) and to source files as `../packages/...` etc.
// Rewrite the former into real `/docs/...` routes and the latter into GitHub
// links, since raw filesystem paths aren't real routes on the deployed site.
function resolveHref(href: string): string {
  if (/^https?:\/\//.test(href) || href.startsWith("#")) return href;

  const [pathPart, hash] = href.split("#");
  const suffix = hash ? `#${hash}` : "";

  const mdMatch = pathPart.match(/^([\w.-]+)\.md$/);
  if (mdMatch) {
    const slug = mdMatch[1];
    if (DOC_SLUGS.has(slug)) {
      return (slug === "README" ? "/docs" : `/docs/${slug}`) + suffix;
    }
  }

  // Anything else relative (../README.md, ../packages/agent-sdk, ../PROJECT_LOG.md,
  // ./docs/sybil-model.md from the root README, etc.) → point at GitHub.
  const cleaned = pathPart.replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");
  return `${REPO}/blob/main/${cleaned}${suffix}`;
}

/** Flatten a heading's children to plain text for slugging. */
function flattenText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (typeof node === "object" && "props" in node) {
    return flattenText(
      (node as { props: { children?: React.ReactNode } }).props.children,
    );
  }
  return "";
}

// Heading slug matching the anchor convention the doc sources cross-link
// with (e.g. credit-engine.md#2-the-independence-engine---the-sybil-…):
// lowercase, em/en dashes → hyphens (so " — " becomes "---"), drop other
// punctuation, spaces → hyphens.
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[—–]/g, "-")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

export default function DocContent({ markdown }: { markdown: string }) {
  // Per-render duplicate-slug counter (GitHub appends -1, -2, …).
  const slugCounts = new Map<string, number>();

  const heading = (Tag: "h1" | "h2" | "h3" | "h4") =>
    function Heading({ children }: { children?: React.ReactNode }) {
      let id = slugify(flattenText(children));
      const seen = slugCounts.get(id) ?? 0;
      slugCounts.set(id, seen + 1);
      if (seen > 0) id = `${id}-${seen}`;
      return (
        <Tag id={id}>
          {children}
          {/* the "#" glyph lives in CSS ::after so TOC textContent stays clean */}
          <a
            href={`#${id}`}
            className="doc-anchor"
            aria-label="Link to this section"
          />
        </Tag>
      );
    };

  return (
    <article className="doc-content max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: heading("h1"),
          h2: heading("h2"),
          h3: heading("h3"),
          h4: heading("h4"),
          a: ({ href, children, ...props }) => (
            <a
              href={href ? resolveHref(href) : undefined}
              target={href && /^https?:\/\//.test(href) ? "_blank" : undefined}
              rel={href && /^https?:\/\//.test(href) ? "noreferrer" : undefined}
              {...props}
            >
              {children}
            </a>
          ),
          pre: ({ children }) => {
            const child = children as { props?: { className?: string } };
            if (/language-mermaid/.test(child?.props?.className || "")) {
              return <>{children}</>; // unwrap — Mermaid renders its own container
            }
            return <CodeBlock>{children}</CodeBlock>;
          },
          code: ({ className, children, ...props }) => {
            const isMermaid = /language-mermaid/.test(className || "");
            if (isMermaid) {
              return <Mermaid chart={String(children).replace(/\n$/, "")} />;
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
