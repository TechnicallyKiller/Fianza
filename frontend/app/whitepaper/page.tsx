"use client";

// /whitepaper — the protocol paper, read in-page. react-pdf is client-only
// (it touches DOMMatrix/canvas), so the viewer is loaded with ssr:false.

import dynamic from "next/dynamic";
import Link from "next/link";
import { Download, ExternalLink, FileCode } from "lucide-react";
import TLShell from "@/components/tl/TLShell";

const PdfViewer = dynamic(() => import("@/components/tl/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-white/[0.09] bg-obsidian/60 py-28 text-center font-tl-mono text-xs text-ash">
      loading viewer…
    </div>
  ),
});

const PDF = "/fianza-whitepaper.pdf";

export default function WhitepaperPage() {
  return (
    <TLShell>
      <main className="mx-auto w-full max-w-[1000px] px-[30px] pb-20 pt-11">
        <div className="mb-2 font-tl-mono text-[11px] tracking-[0.2em] text-nectar">
          / WHITEPAPER
        </div>
        <h1 className="max-w-[22ch] font-tl-serif text-2xl leading-[1.15] tracking-[-0.01em] text-bone sm:text-[34px]">
          Uncollateralized Credit for Autonomous Agents
        </h1>
        <p className="mt-3 max-w-[62ch] font-tl-sans text-[15px] leading-[1.7] text-ash">
          A revenue-underwritten lending protocol on Stellar. How an agent&apos;s
          provable income becomes a credit line, why counterparty independence is
          the hard problem, and what the model still doesn&apos;t solve.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-tl-mono text-[11px] text-[#5a635e]">
          <span>Divyanshh Kalra · Kundan Kumar</span>
          <span>Version 1.0 — August 2026</span>
          <span>11 pages</span>
        </div>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <a
            href={PDF}
            download
            className="inline-flex items-center gap-2 rounded-lg bg-nectar px-4 py-2.5 font-tl-sans text-sm font-semibold text-obsidian transition-colors hover:bg-[#ffbf40]"
          >
            <Download size={15} />
            Download PDF
          </a>
          <a
            href="https://github.com/TechnicallyKiller/Fianza/blob/main/docs/whitepaper.tex"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/12 px-4 py-2.5 font-tl-mono text-xs text-ash transition-colors hover:border-white/25 hover:text-bone"
          >
            <FileCode size={14} />
            LaTeX source
          </a>
          <a
            href="https://docs.fianza.space"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/12 px-4 py-2.5 font-tl-mono text-xs text-ash transition-colors hover:border-white/25 hover:text-bone"
          >
            Documentation
            <ExternalLink size={13} />
          </a>
        </div>

        <div className="mt-9">
          <PdfViewer file={PDF} title="the whitepaper" />
        </div>

        <p className="mt-5 font-tl-mono text-[11px] leading-[1.7] text-[#5a635e]">
          Every formula in the paper is the one the contracts enforce — tier
          multiples, the credit ramp, the interest split and the independence
          weighting are lifted from{" "}
          <Link href="/portfolio" className="text-ash underline hover:text-bone">
            the live protocol
          </Link>
          , not restated. Sections 11 and 13 state what the model does not solve.
        </p>
      </main>
    </TLShell>
  );
}
