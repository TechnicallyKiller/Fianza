// Minimal footer for the marketing pages.
export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-white/5">
      <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-4 px-gutter py-8 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <span className="text-body-md font-bold text-on-surface">
            Fianza
          </span>
          <span className="text-body-sm text-on-surface-variant">
            On-chain credit for AI agents, on Stellar.
          </span>
        </div>
        <div className="flex items-center gap-6 text-body-sm text-on-surface-variant">
          <span className="rounded-full border border-tertiary/30 bg-tertiary-container/20 px-2 py-1 font-label-caps text-label-caps text-tertiary">
            Testnet
          </span>
          <span className="font-data-md text-data-md">Stellar · Soroban · x402</span>
        </div>
      </div>
    </footer>
  );
}
