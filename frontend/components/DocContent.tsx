import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { allDocSlugs } from "@/lib/docs-nav";
import Mermaid from "@/components/Mermaid";

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

export default function DocContent({ markdown }: { markdown: string }) {
  return (
    <article className="doc-content max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
          pre: ({ children, ...props }) => {
            const child = children as { props?: { className?: string } };
            if (/language-mermaid/.test(child?.props?.className || "")) {
              return <>{children}</>; // unwrap — Mermaid renders its own container
            }
            return <pre {...props}>{children}</pre>;
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
