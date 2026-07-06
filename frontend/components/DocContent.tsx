import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { allDocSlugs } from "@/lib/docs-nav";

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
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
