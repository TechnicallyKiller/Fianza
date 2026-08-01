// Split hero — human (lenders/USDC) on the left, machine (agents/proof) on
// the right, joined by the gradient "seam". First thing visible on /.

export default function SplitHero() {
  return (
    <div className="relative z-[1] grid grid-cols-1 md:grid-cols-[1fr_3px_1fr] md:min-h-[74vh]">
      {/* human side */}
      <div className="tl-anim-hero-l relative flex flex-col justify-center bg-bone px-[6vw] py-[10vh] text-obsidian">
        <div className="mb-[26px] font-tl-mono text-[11px] tracking-[0.16em] text-[#8a8578]">
          HUMAN · CAPITAL · TRUST →
        </div>
        <div className="font-tl-serif text-[min(15vw,86px)] font-semibold leading-[0.9] tracking-[-0.025em] text-obsidian">
          Warm
          <br />
          money.
        </div>
        <div className="mt-1 font-tl-serif text-[min(15vw,86px)] font-normal italic leading-[0.9] tracking-[-0.025em] text-nectar">
          Real trust.
        </div>
        <p className="mt-[30px] max-w-[340px] font-tl-serif text-[15px] leading-[1.6] text-[#5b564a]">
          Lenders supply USDC into an agent&apos;s own isolated vault and earn
          yield as it repays — capital that flows to machines that have
          proven they earn.
        </p>
      </div>

      {/* seam */}
      <div className="tl-anim-seam hidden bg-gradient-to-b from-nectar to-ion shadow-[0_0_30px_3px_rgba(88,240,200,0.4)] md:block" />
      <div className="h-[3px] w-full bg-gradient-to-r from-nectar to-ion md:hidden" />

      {/* machine side */}
      <div className="tl-anim-hero-r relative flex flex-col justify-center overflow-hidden bg-void px-[6vw] py-[10vh] text-right">
        <div className="mb-[26px] font-tl-mono text-[11px] tracking-[0.16em] text-[#4d564f]">
          ← MACHINE · PROOF · SPEED
        </div>
        <div className="font-tl-serif text-[min(15vw,86px)] font-semibold leading-[0.9] tracking-[-0.025em] text-bone">
          Cold
          <br />
          proof.
        </div>
        <div className="mt-1 font-tl-serif text-[min(15vw,86px)] font-normal italic leading-[0.9] tracking-[-0.025em] text-ion">
          Machine speed.
        </div>
        <p className="ml-auto mt-[30px] max-w-[340px] font-tl-serif text-[15px] leading-[1.6] text-[#7d857e]">
          Agents prove revenue on-chain, get scored by an adversarial engine,
          and draw credit in seconds — not a bank&apos;s underwriting cycle.
        </p>
        <div className="mt-[26px] flex items-center justify-end gap-2 font-tl-mono text-[10px] leading-[1.7] text-[#3d463f]">
          <span className="tl-anim-blink h-[6px] w-[6px] rounded-full bg-ion" />
          verified on Stellar testnet · settles in seconds
        </div>
      </div>
    </div>
  );
}
