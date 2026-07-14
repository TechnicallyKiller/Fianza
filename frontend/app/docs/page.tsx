import Link from "next/link";
import DocShell from "@/components/docs/DocShell";
import Reveal from "@/components/tl/Reveal";
import { readDoc } from "@/lib/docs";

export const metadata = { title: "Docs — TrustLine" };

// "Start here" persona cards — the fast path into the four things a visitor
// actually comes for. The README markdown below carries the full detail.
const CARDS = [
  {
    label: "ONBOARDING KIT",
    title: "Build an agent on credit",
    desc: "Fund a testnet wallet, register, get underwritten, borrow — the full copy-pasteable path.",
    href: "/docs/onboarding-kit",
    accent: "#FFB020",
  },
  {
    label: "PROTOCOL",
    title: "Understand the credit engine",
    desc: "Default lifecycle, first-loss reserve, credit ramps, dynamic APR — the risk machinery.",
    href: "/docs/credit-engine",
    accent: "#58F0C8",
  },
  {
    label: "SDK REFERENCE",
    title: "Wire up the SDK",
    desc: "register → underwrite → borrow → repay, plus payWithCredit for draw-on-402.",
    href: "/docs/sdk-reference",
    accent: "#58F0C8",
  },
  {
    label: "CONTRACTS",
    title: "See what's deployed",
    desc: "Every live contract address on testnet — current and superseded, with why each is kept.",
    href: "/docs/contracts",
    accent: "#FFB020",
  },
];

export default function DocsIndexPage() {
  const markdown = readDoc("README");
  return (
    <div>
      {/* hero */}
      <div className="tl-anim-fadeup mb-10">
        <div className="mb-3 font-tl-mono text-[11px] tracking-[0.22em] text-ion">
          / DOCS
        </div>
        <h1 className="max-w-[16ch] font-tl-serif text-[min(6vw,44px)] font-normal leading-[1.1] tracking-[-0.02em] text-bone">
          Everything the <span className="italic text-ion">line</span> runs on.
        </h1>
        <p className="mt-4 max-w-[58ch] font-tl-sans text-[15px] leading-[1.7] text-ash">
          Protocol internals, the anti-Sybil independence model, contract
          addresses, and a kit to get an agent underwritten — honestly framed,
          live on Stellar testnet.
        </p>
      </div>

      {/* start-here cards */}
      <div className="mb-12 grid gap-4 sm:grid-cols-2">
        {CARDS.map((c, i) => (
          <Reveal key={c.href} variant="up" delay={i * 0.07} className="h-full">
            <Link
              href={c.href}
              className="group flex h-full flex-col rounded-xl border border-bone/[0.08] bg-void/60 p-5 transition-colors hover:border-bone/25"
            >
              <div
                className="font-tl-mono text-[10px] tracking-[0.16em]"
                style={{ color: c.accent }}
              >
                {c.label}
              </div>
              <div className="mt-2 font-tl-serif text-[19px] leading-snug text-bone">
                {c.title}
              </div>
              <div className="mt-2 flex-1 font-tl-sans text-[13px] leading-[1.65] text-ash">
                {c.desc}
              </div>
              <div
                className="mt-3 font-tl-mono text-xs transition-transform group-hover:translate-x-1"
                style={{ color: c.accent }}
              >
                →
              </div>
            </Link>
          </Reveal>
        ))}
      </div>

      <DocShell slug="README" markdown={markdown} hideHeader />
    </div>
  );
}
