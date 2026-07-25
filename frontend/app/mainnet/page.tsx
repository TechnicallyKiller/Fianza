"use client";

// /mainnet — the honest mainnet status page. Fianza's three contracts are
// deployed for real on Stellar mainnet, settling in Circle's actual USDC — but
// the live product/backend still runs on testnet while the lender/liquidity
// side is built out. This page states both facts plainly: real contracts,
// real addresses, real tx — and NOT yet wired to the app you can click around.

import TLNav from "@/components/tl/TLNav";
import { CheckCircle2, ExternalLink, Info, ShieldCheck } from "lucide-react";

const EXPLORER_CONTRACT = (id: string) =>
  `https://stellar.expert/explorer/public/contract/${id}`;
const EXPLORER_TX = (hash: string) => `https://stellar.expert/explorer/public/tx/${hash}`;
const EXPLORER_ACCOUNT = (id: string) => `https://stellar.expert/explorer/public/account/${id}`;

const CONTRACTS = [
  {
    name: "Score Registry",
    id: "CAHWYFLMQI6BBOL6ZLZRRINCK6KVBX73ACH7LCPB24WDED4LSMCI7YZC",
    note: "Registration, signed score attestations, repayment history.",
    deployTx: "35e5db00b2348a3b1ecde04e1dfc8a7d611d7b40f9e68ff99c659d098130067b",
  },
  {
    name: "Credit Line",
    id: "CDK7S4UWY227FHFKDSV37DGT7AIJ5Z2QEYO5AY456M7RBGJN25WYJVGC",
    note: "Read-only tier/limit/APR terms, derived from the registry's score.",
    deployTx: "4e1b97310cdebe15ec072c2568ec2ca91d02a45dcd1df86ddf47b2154e95a784",
  },
  {
    name: "Lending Vault",
    id: "CAE5C5UJYVED5DAVY4YKYT6E2C4NBZCIUBAK2MXGKGLKZESBBXKFPZ4U",
    note: "Isolated per-agent vaults — borrow, repay, default, lender shares.",
    deployTx: "bece5fd19410721042c0cd9feeaa5470a892df0709fbc1b76788093f3bb466e3",
  },
];

const USDC_TOKEN = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

export default function MainnetPage() {
  return (
    <div className="tl-select relative min-h-screen bg-obsidian text-bone">
      <TLNav />
      <div className="tl-grain relative mx-auto w-full max-w-[880px] px-6 py-16 md:px-10">
        <div className="tl-anim-fadeup">
          <div className="mb-3 font-tl-mono text-[11px] tracking-[0.22em] text-ion">
            / MAINNET STATUS
          </div>
          <h1 className="font-tl-serif text-[min(6.5vw,44px)] font-normal leading-[1.07] tracking-[-0.02em]">
            Real contracts, <span className="italic text-nectar">real mainnet</span>.
            Not yet the live app.
          </h1>
          <p className="mt-4 max-w-xl font-tl-sans text-sm leading-[1.7] text-ash">
            Fianza&apos;s three Soroban contracts are deployed on Stellar
            mainnet, settling in Circle&apos;s real USDC — not a testnet stand-in.
            The product you can click around today still runs on{" "}
            <span className="text-bone">testnet</span> while the mainnet
            lender/liquidity side is built out. This page is the honest,
            verifiable record of what&apos;s actually live where.
          </p>
        </div>

        {/* the honest split */}
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-ion/25 bg-ion/[0.05] p-4">
            <div className="mb-1.5 flex items-center gap-2 font-tl-mono text-[11px] tracking-[0.12em] text-ion">
              <CheckCircle2 size={13} /> LIVE ON MAINNET
            </div>
            <p className="font-tl-sans text-[13px] leading-[1.6] text-ash">
              The 3 contracts below. Deployed, callable, verified — click any
              address to inspect it yourself.
            </p>
          </div>
          <div className="rounded-xl border border-nectar/25 bg-nectar/[0.05] p-4">
            <div className="mb-1.5 flex items-center gap-2 font-tl-mono text-[11px] tracking-[0.12em] text-nectar">
              <Info size={13} /> STILL TESTNET
            </div>
            <p className="font-tl-sans text-[13px] leading-[1.6] text-ash">
              The backend, the underwriting API, the demo agent, the credit
              book — everything you can actually use today.
            </p>
          </div>
        </div>

        {/* contracts */}
        <div className="mt-10">
          <h2 className="mb-3 font-tl-serif text-xl text-bone">The contracts</h2>
          <div className="flex flex-col gap-3">
            {CONTRACTS.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-white/[0.08] bg-void/50 p-4"
              >
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-tl-sans text-sm font-semibold text-bone">
                    {c.name}
                  </span>
                  <span className="rounded-full border border-ion/30 bg-ion/10 px-2 py-0.5 font-tl-mono text-[10px] text-ion">
                    mainnet
                  </span>
                </div>
                <p className="mb-2.5 font-tl-sans text-[12px] leading-[1.6] text-ash">
                  {c.note}
                </p>
                <div className="flex flex-col gap-1.5 font-tl-mono text-[11px]">
                  <a
                    href={EXPLORER_CONTRACT(c.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-ion hover:text-nectar"
                  >
                    {c.id}
                    <ExternalLink size={11} />
                  </a>
                  <a
                    href={EXPLORER_TX(c.deployTx)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-ash hover:text-bone"
                  >
                    deploy tx: {c.deployTx.slice(0, 10)}…{c.deployTx.slice(-6)}
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* config */}
        <div className="mt-10">
          <h2 className="mb-3 font-tl-serif text-xl text-bone">Configuration</h2>
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-void/50">
            <Row label="Settlement token" value="USDC (Circle, mainnet)">
              <a
                href={EXPLORER_CONTRACT(USDC_TOKEN)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-tl-mono text-[11px] text-ion hover:text-nectar"
              >
                {USDC_TOKEN.slice(0, 10)}…{USDC_TOKEN.slice(-6)} <ExternalLink size={10} />
              </a>
            </Row>
            <Row label="USDC issuer" value="Circle (official)">
              <a
                href={EXPLORER_ACCOUNT(USDC_ISSUER)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-tl-mono text-[11px] text-ion hover:text-nectar"
              >
                {USDC_ISSUER.slice(0, 10)}…{USDC_ISSUER.slice(-6)} <ExternalLink size={10} />
              </a>
            </Row>
            <Row label="Loan term" value="30 days" />
            <Row label="Deposit cap" value="$100 / agent vault (launch-conservative, admin-adjustable)" />
          </div>
        </div>

        {/* roadmap note */}
        <div className="mt-10 flex items-start gap-3 rounded-xl border border-white/[0.08] bg-void/50 p-5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-ion" />
          <div>
            <p className="font-tl-sans text-sm font-semibold text-bone">
              Why the app still runs on testnet
            </p>
            <p className="mt-1.5 max-w-2xl font-tl-sans text-[13px] leading-[1.65] text-ash">
              A credit product needs someone to actually fund the vaults —
              today that&apos;s Fianza&apos;s own treasury on testnet, a
              deliberate bootstrap posture, not a mainnet one. Wiring the live
              product to these mainnet contracts means standing up the pooled
              lender market first (see the{" "}
              <span className="text-bone">credit book</span> and its lender-pool
              teaser), so real third-party capital — not Fianza&apos;s own
              money — is what funds mainnet agents. The contracts are ready
              today; the liquidity side is the next build.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] px-4 py-3 last:border-0">
      <div>
        <div className="font-tl-mono text-[10px] tracking-[0.1em] text-ash/70">
          {label.toUpperCase()}
        </div>
        <div className="font-tl-sans text-[13px] text-bone">{value}</div>
      </div>
      {children}
    </div>
  );
}
