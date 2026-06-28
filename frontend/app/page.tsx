import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Check,
  Share2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const features = [
  {
    icon: ShieldCheck,
    title: "Revenue-based underwriting",
    body: "Credit limits are a multiple of verified trailing income — on-chain x402 earnings plus zkTLS-attested off-chain revenue — not a proxy for it.",
  },
  {
    icon: Boxes,
    title: "Isolated risk per agent",
    body: "Every credit line is its own vault. One agent's default never touches another lender's deposit. No pooled, socialized losses.",
  },
  {
    icon: Zap,
    title: "x402-native settlement",
    body: "Disbursement, repayment, and interest all move autonomously in USDC over x402 on Stellar, at fees near $0.00001.",
  },
  {
    icon: Share2,
    title: "Portable score",
    body: "The ScoreRegistry is keyed to a stable Stellar address and readable on-chain by any lender — not locked into TrustLine.",
  },
];

const steps = [
  { n: "01", title: "Register", body: "An agent registers against its stable Stellar address." },
  { n: "02", title: "Underwrite", body: "The engine indexes x402 revenue and verifies a Reclaim zkTLS revenue proof." },
  { n: "03", title: "Publish", body: "A trusted signer publishes a signed score + credit limit on-chain." },
  { n: "04", title: "Fund", body: "A lender deposits USDC into that agent's isolated vault." },
  { n: "05", title: "Borrow & repay", body: "The agent draws a credit line and repays principal + interest over x402." },
];

const gates = [
  {
    tag: "Gate 1",
    title: "x402 payer identity",
    body: "A settled x402 payment records the SAC transfer.from as the agent, not the facilitator. Distinct payers are countable on-chain.",
  },
  {
    tag: "Gate 2A",
    title: "Reclaim verifier leg",
    body: "A fresh zkTLS proof verifies against the deployed Soroban verifier contract with a SUCCESS transaction.",
  },
  {
    tag: "Gate 2B",
    title: "Private revenue proof",
    body: "A private Stripe balance proven on Soroban via Reclaim, with the API key held in private options and absent from the proof.",
  },
];

export default function Home() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-gutter">
        {/* Hero */}
        <section className="grid grid-cols-1 items-center gap-stack-lg py-16 md:py-24 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-label-caps text-label-caps text-primary">
              Credit infrastructure for AI agents
            </span>
            <h1 className="mt-6 max-w-2xl text-display-lg font-display-lg text-on-surface">
              Credit for AI agents, underwritten by revenue they can prove.
            </h1>
            <p className="mt-6 max-w-xl text-body-lg text-on-surface-variant">
              TrustLine turns an agent&apos;s verifiable, trailing revenue into
              an uncollateralized credit line. The score is not a credibility
              badge — it&apos;s a real lending decision, sized against income an
              agent can prove, settling autonomously in USDC over x402.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/coming-soon"
                className="electric-blue-glow inline-flex items-center gap-2 rounded bg-primary-container px-6 py-3 font-body-md font-medium text-on-primary-container transition-all duration-300 hover:scale-[1.02] hover:bg-primary hover:text-surface"
              >
                Launch app
                <ArrowRight size={18} />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded border border-white/10 bg-surface-dim/20 px-6 py-3 font-body-md text-on-surface-variant backdrop-blur-sm transition-colors duration-200 hover:border-primary/40 hover:text-on-surface"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Dashboard-style stat card echoing the product UI */}
          <div className="lg:col-span-5">
            <div className="glass-card glass-card-hover animate-enter rounded-lg p-card-padding">
              <div className="mb-stack-md flex items-center justify-between border-b border-white/10 pb-stack-sm">
                <span className="text-body-sm text-on-surface-variant">
                  Agent credit overview
                </span>
                <span className="rounded-full border border-tertiary/30 bg-tertiary-container/20 px-2 py-1 font-label-caps text-label-caps text-tertiary">
                  Testnet
                </span>
              </div>
              <div className="grid grid-cols-2 gap-stack-md">
                <Stat label="Credit Score" value="720" pill="Tier B" />
                <Stat label="Fixed APR" value="8.5%" />
                <Stat label="Available Credit" value="50,000" unit="USDC" />
                <Stat label="Verified Revenue (30d)" value="25,000" unit="USDC" />
              </div>
              <div className="mt-stack-md">
                <div className="mb-1 flex justify-between text-body-sm">
                  <span className="text-on-surface-variant">
                    Revenue Coverage Ratio
                  </span>
                  <span className="font-data-md text-on-surface">High</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full border border-white/5 bg-surface-dim/50">
                  <div className="h-full w-[85%] bg-primary shadow-[0_0_10px_rgba(173,198,255,0.5)]" />
                </div>
              </div>
            </div>
            <p className="mt-3 text-center font-data-md text-data-md text-on-surface-variant">
              Illustrative — live data ships with the dashboards.
            </p>
          </div>
        </section>

        {/* Product / features */}
        <section id="product" className="scroll-mt-20 py-16">
          <SectionHeading
            overline="The product"
            title="Underwriting, not a reputation badge"
            subtitle="The defensible IP is the credit decision and the Sybil model — the lending shell is deliberately simple."
          />
          <div className="mt-stack-lg grid grid-cols-1 gap-stack-md sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="glass-card glass-card-hover rounded-lg p-card-padding"
              >
                <div className="mb-4 inline-flex rounded-full border border-primary/20 bg-primary/10 p-3 text-primary">
                  <f.icon size={20} />
                </div>
                <h3 className="text-body-lg font-medium text-on-surface">
                  {f.title}
                </h3>
                <p className="mt-2 text-body-sm text-on-surface-variant">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 py-16">
          <SectionHeading
            overline="How it works"
            title="Register, get underwritten, borrow, repay"
            subtitle="One protocol with a hybrid execution model: an off-chain engine computes borrowing power; Soroban contracts hold funds and enforce it."
          />
          <div className="mt-stack-lg grid grid-cols-1 gap-stack-md md:grid-cols-5">
            {steps.map((s) => (
              <div
                key={s.n}
                className="glass-card rounded-lg p-card-padding"
              >
                <div className="font-data-lg text-data-lg text-primary">
                  {s.n}
                </div>
                <h3 className="mt-3 text-body-md font-medium text-on-surface">
                  {s.title}
                </h3>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Validation */}
        <section id="validation" className="scroll-mt-20 py-16">
          <SectionHeading
            overline="Validation status"
            title="The load-bearing risks are measured, not assumed"
            subtitle="Both of the two unknowns that could have sunk the build were isolated into spikes on Stellar testnet. Both pass."
          />
          <div className="mt-stack-lg grid grid-cols-1 gap-stack-md md:grid-cols-3">
            {gates.map((g) => (
              <div
                key={g.tag}
                className="glass-card glass-card-hover rounded-lg p-card-padding"
              >
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-label-caps text-on-surface-variant">
                    {g.tag}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-secondary/30 bg-secondary/10 px-2 py-1 font-label-caps text-label-caps text-secondary">
                    <Check size={12} /> PASS
                  </span>
                </div>
                <h3 className="mt-3 text-body-lg font-medium text-on-surface">
                  {g.title}
                </h3>
                <p className="mt-2 text-body-sm text-on-surface-variant">
                  {g.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Audience CTA */}
        <section className="py-16">
          <div className="grid grid-cols-1 gap-stack-md md:grid-cols-2">
            <AudienceCard
              title="For agents & operators"
              body="Turn provable income into working capital. Register, prove revenue, and draw a credit line that settles itself."
              cta="Open the borrower dashboard"
            />
            <AudienceCard
              title="For lenders"
              body="Pick an agent, see its underwriting history, and fund an isolated vault for a higher yield than a pooled market pays."
              cta="Open the lender dashboard"
            />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  pill,
}: {
  label: string;
  value: string;
  unit?: string;
  pill?: string;
}) {
  return (
    <div className="rounded border border-white/5 bg-surface-dim/30 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-on-surface-variant">{label}</span>
        {pill ? (
          <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-label-caps text-label-caps text-primary">
            {pill}
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-data-lg text-data-lg text-on-surface">
          {value}
        </span>
        {unit ? (
          <span className="font-data-md text-body-sm text-on-surface-variant">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeading({
  overline,
  title,
  subtitle,
}: {
  overline: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="max-w-2xl">
      <span className="font-label-caps text-label-caps text-primary">
        {overline}
      </span>
      <h2 className="mt-2 text-headline-lg font-headline-lg text-on-surface">
        {title}
      </h2>
      <p className="mt-3 text-body-md text-on-surface-variant">{subtitle}</p>
    </div>
  );
}

function AudienceCard({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <div className="glass-card glass-card-hover rounded-lg p-card-padding">
      <h3 className="text-headline-md font-headline-md text-on-surface">
        {title}
      </h3>
      <p className="mt-3 max-w-md text-body-md text-on-surface-variant">
        {body}
      </p>
      <Link
        href="/coming-soon"
        className="mt-6 inline-flex items-center gap-2 font-body-md text-primary transition-colors hover:text-primary-container"
      >
        {cta}
        <ArrowRight size={18} />
      </Link>
    </div>
  );
}
