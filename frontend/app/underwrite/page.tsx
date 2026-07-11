"use client";

// Underwrite — TrustLine.dc.html "LIVE INSTRUMENT". Paste a Stellar address,
// watch the real backend score it: an animated verdict, a waterfall showing
// declared revenue collapsing to effective revenue (computed from the real
// independence engine's per-payer weights — not decorative), and the
// per-payer breakdown with the backend's own reason strings.

import { useCallback, useEffect, useRef, useState } from "react";
import TLNav from "@/components/tl/TLNav";
import {
  api,
  usdc,
  aprPct,
  tierLabel,
  shortAddr,
  ApiError,
  type UnderwritingResult,
  type PayerWeight,
} from "@/lib/api";

// The live on-chain circular-funding attacker built in the Track B showcase.
const ATTACKER = "GAUVEA27XMTZGBTGRETNR2RVQNFP23IP62LAB6T4GDPF5DAKL5HGCB2I";
const MAX_SCORE = 850; // mirrors backend/src/scoring/index.ts clamp

interface Preset {
  label: string;
  hint: string;
  address: string;
}

type Phase = "input" | "scanning" | "resolving" | "done" | "error";

const STAGES = [
  "walking the payment graph…",
  "scoring counterparty independence…",
  "pricing the credit line…",
];

export default function UnderwritePage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<UnderwritingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("input");
  const [stageIdx, setStageIdx] = useState(0);
  const [liveScore, setLiveScore] = useState(0);

  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const raf = useRef<number | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api
      .demo()
      .then((d) => {
        const p: Preset[] = [];
        if (d.honestAgent)
          p.push({ label: "earning agent", hint: "real independent customers", address: d.honestAgent });
        if (d.sybilAgent)
          p.push({ label: "self-pay sybil", hint: "pays itself from its own wallets", address: d.sybilAgent });
        p.push({ label: "live attacker", hint: "circular-funding loop, on-chain", address: ATTACKER });
        setPresets(p);
      })
      .catch(() => {
        setPresets([{ label: "live attacker", hint: "circular-funding loop, on-chain", address: ATTACKER }]);
      });
  }, []);

  useEffect(
    () => () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
      if (raf.current) cancelAnimationFrame(raf.current);
      if (doneTimer.current) clearTimeout(doneTimer.current);
    },
    [],
  );

  const animateScore = useCallback((target: number) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (doneTimer.current) clearTimeout(doneTimer.current);
    const start = performance.now();
    const dur = 1000;
    const finish = () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
      if (raf.current) cancelAnimationFrame(raf.current);
      setLiveScore(target);
      setPhase("done");
    };
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setLiveScore(Math.round(target * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else finish();
    };
    raf.current = requestAnimationFrame(tick);
    // Safety net: requestAnimationFrame is throttled in backgrounded tabs (and
    // some reduced-motion setups), which would otherwise leave the verdict stuck
    // on "scoring…" forever even though the result already arrived. Guarantee it
    // resolves regardless.
    doneTimer.current = setTimeout(finish, dur + 400);
  }, []);

  const run = useCallback(
    async (addr: string) => {
      const target = addr.trim();
      if (!target) return;
      if (stageTimer.current) clearInterval(stageTimer.current);
      if (raf.current) cancelAnimationFrame(raf.current);
      setAddress(target);
      setResult(null);
      setError(null);
      setLiveScore(0);
      setPhase("scanning");
      let i = 0;
      setStageIdx(0);
      stageTimer.current = setInterval(() => setStageIdx(++i % STAGES.length), 1300);
      try {
        const r = await api.underwrite(target, { skipProof: true });
        setResult(r);
        setPhase("resolving");
        animateScore(r.score.score);
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? `${e.message} — the backend may be asleep (free tiers sleep ~15 min; retry in ~30s).`
            : e instanceof Error
              ? e.message
              : String(e);
        setError(msg);
        setPhase("error");
      } finally {
        if (stageTimer.current) clearInterval(stageTimer.current);
      }
    },
    [animateScore],
  );

  const reset = () => {
    if (stageTimer.current) clearInterval(stageTimer.current);
    if (raf.current) cancelAnimationFrame(raf.current);
    setPhase("input");
    setResult(null);
    setError(null);
    setLiveScore(0);
  };

  const scanning = phase === "scanning";
  const done = phase === "done";
  const s = result?.score;
  const approved = !!s && s.limitUsdc > 0;

  return (
    <div className="tl-select relative min-h-screen bg-void text-bone">
      <TLNav />

      {phase === "input" ? (
        <div className="tl-grain relative z-[1] mx-auto max-w-[760px] px-[30px] py-[12vh] text-center">
          <div className="mb-[22px] font-tl-mono text-[11px] tracking-[0.22em] text-ion">
            / UNDERWRITE
          </div>
          <h1 className="mx-auto mb-3.5 font-tl-serif text-[min(7vw,64px)] font-normal leading-none tracking-[-0.02em] text-bone">
            Read a live
            <br />
            <span className="italic text-ion">creditworthiness</span> signal.
          </h1>
          <p className="mx-auto mb-[42px] max-w-[46ch] font-tl-mono text-sm leading-[1.6] text-ash">
            Paste a Stellar address. The engine walks its payment graph,
            discounts what it can&apos;t verify, and returns a score in
            seconds.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(address);
            }}
            className="mx-auto flex max-w-[560px] gap-2.5"
          >
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="G… paste a Stellar address"
              spellCheck={false}
              className="flex-1 rounded-[9px] border border-ion/30 bg-obsidian px-[18px] py-4 font-tl-mono text-sm text-bone outline-none"
            />
            <button
              type="submit"
              disabled={!address.trim()}
              className="whitespace-nowrap rounded-[9px] bg-ion px-6 py-4 font-tl-sans text-sm font-semibold text-obsidian transition-colors hover:bg-nectar disabled:opacity-50"
            >
              Resolve →
            </button>
          </form>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5 font-tl-mono text-xs">
            {presets.map((p) => (
              <button
                key={p.address}
                onClick={() => run(p.address)}
                className="rounded-full border border-nectar/35 px-3.5 py-2 text-nectar transition-colors hover:bg-nectar/10"
                title={p.hint}
              >
                try: {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="tl-grain tl-anim-fadeup relative z-[1] mx-auto max-w-[1060px] px-[30px] pb-20 pt-10">
          {/* head */}
          <div className="mb-0 flex items-center justify-between border-b border-ion/[0.14] pb-5">
            <div className="flex items-center gap-3">
              <button
                onClick={reset}
                className="font-tl-mono text-xs text-[#5a635e] transition-colors hover:text-bone"
              >
                ← new
              </button>
              <span className="font-tl-mono text-sm font-bold text-bone">
                {shortAddr(address)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="tl-anim-blink h-2 w-2 rounded-full"
                style={{
                  background: phase === "error" ? "#FF5C4D" : done ? (approved ? "#58F0C8" : "#FF5C4D") : "#FFB020",
                  boxShadow: `0 0 8px ${phase === "error" ? "#FF5C4D" : done ? (approved ? "#58F0C8" : "#FF5C4D") : "#FFB020"}`,
                }}
              />
              <span
                className="font-tl-mono text-xs tracking-[0.05em]"
                style={{ color: phase === "error" ? "#FF5C4D" : done ? (approved ? "#58F0C8" : "#FF5C4D") : "#FFB020" }}
              >
                {phase === "error"
                  ? "failed"
                  : phase === "scanning"
                    ? STAGES[stageIdx]
                    : phase === "resolving"
                      ? "scoring…"
                      : approved
                        ? "verified"
                        : "not lending grade"}
              </span>
            </div>
          </div>

          {phase === "error" ? (
            <div className="mt-9 rounded-xl border border-flare/40 bg-flare/[0.06] p-8">
              <div className="font-tl-mono text-xs font-bold tracking-[0.08em] text-flare">
                REQUEST FAILED
              </div>
              <p className="mt-3 font-tl-serif text-lg leading-[1.6] text-bone">
                {error}
              </p>
              <button
                onClick={() => run(address)}
                className="mt-5 rounded-lg border border-flare/40 px-4 py-2 font-tl-mono text-xs text-flare transition-colors hover:bg-flare/10"
              >
                retry →
              </button>
            </div>
          ) : (
            <>
              <RevenueTrace payments={result?.revenue.payments} scanning={scanning} />

              {/* verdict header row */}
              <div className="grid grid-cols-1 border-b border-ion/[0.12] md:grid-cols-[1.2fr_1px_1fr]">
                <div className="pb-[30px] pr-[34px] pt-[30px]">
                  <div className="mb-3.5 font-tl-mono text-[10px] tracking-[0.16em] text-ash">
                    VERDICT
                  </div>
                  <div className="mb-[18px] flex items-end gap-3.5">
                    <div
                      className="font-tl-sans text-[76px] font-bold leading-[0.78] tracking-[-0.04em]"
                      style={{ color: done ? "#F4F1E9" : "#A7ADA6" }}
                    >
                      {liveScore}
                    </div>
                    <div className="pb-2">
                      <div className="font-tl-mono text-[11px] text-[#4d564f]">/ {MAX_SCORE}</div>
                      <div
                        className="mt-1 font-tl-mono text-[13px] font-bold"
                        style={{ color: done ? (approved ? "#58F0C8" : "#FF5C4D") : "#4d564f" }}
                      >
                        {done && s ? `TIER ${tierLabel(s.tier).replace("Tier ", "")}` : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full transition-[width] duration-300"
                      style={{
                        width: `${Math.min(100, (liveScore / MAX_SCORE) * 100)}%`,
                        background: "linear-gradient(90deg,#FF5C4D,#FFB020 55%,#58F0C8)",
                      }}
                    />
                  </div>
                  <div className="flex justify-between font-tl-mono text-[8px] tracking-[0.06em] text-[#4d564f]">
                    <span>UNRATED</span>
                    <span>C·550</span>
                    <span>B·650</span>
                    <span>A·750</span>
                  </div>
                </div>
                <div className="hidden bg-ion/[0.12] md:block" />
                <div className="flex flex-col justify-center gap-[18px] pb-[30px] pl-0 pt-[30px] md:pl-[34px]">
                  <div>
                    <div className="font-tl-mono text-[9px] tracking-[0.12em] text-ash">
                      CREDIT LIMIT
                    </div>
                    <div
                      className="font-tl-sans text-[34px] font-bold"
                      style={{ color: !done ? "#4d564f" : approved ? "#FFB020" : "#FF5C4D" }}
                    >
                      {done && s ? `${usdc(s.limitUsdc)}` : "···"}
                    </div>
                  </div>
                  <div className="flex gap-[34px]">
                    <div>
                      <div className="font-tl-mono text-[9px] tracking-[0.12em] text-ash">APR</div>
                      <div className="font-tl-sans text-xl font-bold text-bone">
                        {done && s && s.aprBps ? aprPct(s.aprBps) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="font-tl-mono text-[9px] tracking-[0.12em] text-ash">
                        EFFECTIVE REV
                      </div>
                      <div className="font-tl-sans text-xl font-bold text-ion">
                        {done && s ? usdc(s.revenueUsdc) : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {done && result && s && approved ? <GoodDone result={result} /> : null}
              {done && result && s && !approved ? <RejectDone result={result} /> : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- decorative → real oscilloscope ----

function RevenueTrace({
  payments,
  scanning,
}: {
  payments?: UnderwritingResult["revenue"]["payments"];
  scanning: boolean;
}) {
  const showReal = !scanning && payments && payments.length > 0;
  let line = "";
  let area = "";
  if (showReal) {
    const sorted = [...payments!].sort((a, b) => a.ledger - b.ledger);
    let cum = 0;
    const pts = sorted.map((p) => {
      cum += Number(p.amount) / 1e7;
      return cum;
    });
    const max = pts[pts.length - 1] || 1;
    const W = 1000;
    const H = 180;
    const x = (i: number) => (pts.length === 1 ? W : (i / (pts.length - 1)) * W);
    const y = (v: number) => H - (v / max) * (H - 30) - 20;
    line = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    area = `${line} L${W},${H} L0,${H} Z`;
  }

  return (
    <div
      className="relative h-[180px] overflow-hidden border-b border-ion/[0.12] bg-[#04100c]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(88,240,200,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(88,240,200,.05) 1px,transparent 1px)",
        backgroundSize: "100% 24px, 48px 100%",
      }}
    >
      {scanning ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="tl-anim-scan absolute left-0 right-0 h-[60px] bg-gradient-to-b from-ion/[0.08] to-transparent" />
        </div>
      ) : null}
      <svg viewBox="0 0 1000 180" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {showReal ? (
          <>
            <defs>
              <linearGradient id="uw-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#58F0C8" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#58F0C8" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#uw-fill)" />
            <path d={line} fill="none" stroke="#58F0C8" strokeWidth="2" style={{ filter: "drop-shadow(0 0 6px rgba(88,240,200,.7))" }} />
          </>
        ) : (
          <path
            d="M0,135 C80,135 110,50 175,50 C240,50 250,135 310,135 C375,135 385,32 460,32 C540,32 545,135 610,135 C680,135 695,72 760,72 C830,72 845,135 910,135 L1000,135"
            fill="none"
            stroke="#58F0C8"
            strokeWidth="2"
            strokeDasharray="7 7"
            className="tl-anim-wave"
            style={{ filter: "drop-shadow(0 0 6px rgba(88,240,200,.7))" }}
          />
        )}
      </svg>
      <div className="absolute bottom-2.5 left-4 font-tl-mono text-[10px] text-[#3d7a6a]">
        REVENUE SIGNAL · x402{showReal ? ` · ${payments!.length} payment(s)` : ""}
      </div>
    </div>
  );
}

// ---- approved: waterfall + per-payer ----

type Bucket = { key: string; label: string; usdc: number; color: string; striped?: boolean };

function GoodDone({ result }: { result: UnderwritingResult }) {
  const s = result.score;
  const ind = result.independence;
  const declared = result.revenue.totalRevenueUsdc;
  const effective = s.revenueUsdc;

  const buckets: Bucket[] = [];
  if (ind && ind.perPayer.length > 0 && declared > 0) {
    const acc: Record<string, number> = { circular: 0, fresh: 0, diversity: 0, reciprocity: 0, concentration: 0 };
    let effectiveSumStroops = 0;
    for (const p of ind.perPayer) {
      const raw = Number(p.revenueStroops);
      const capped = Number(p.cappedStroops);
      const eff = Number(p.effectiveStroops);
      effectiveSumStroops += eff;
      acc.concentration += Math.max(0, raw - capped) / 1e7;
      const weightCut = Math.max(0, capped - eff) / 1e7;
      if (weightCut > 0.0001) {
        const factors: [string, number][] = [
          ["circular", p.notFundedFactor],
          ["fresh", p.ageFactor],
          ["diversity", p.diversityFactor],
          ["reciprocity", p.reciprocityFactor],
        ];
        factors.sort((a, b) => a[1] - b[1]);
        acc[factors[0][0]] += weightCut;
      }
    }
    const finalCut = Math.max(0, effectiveSumStroops - Number(ind.independentRevenueStroops)) / 1e7;
    acc.concentration += finalCut;

    const meta: Record<string, { label: string; color: string; striped?: boolean }> = {
      circular: { label: "SYBIL CUT", color: "#FF5C4D", striped: true },
      fresh: { label: "AGE PENALTY", color: "#A7ADA6" },
      diversity: { label: "LOW DIVERSITY", color: "#A7ADA6" },
      reciprocity: { label: "RECIPROCITY", color: "#A7ADA6" },
      concentration: { label: "CONCENTRATION", color: "#A7ADA6" },
    };
    for (const [key, val] of Object.entries(acc)) {
      if (val > 0.005) buckets.push({ key, label: meta[key].label, usdc: val, color: meta[key].color, striped: meta[key].striped });
    }
  }

  const discountPct = declared > 0 ? Math.round((1 - effective / declared) * 100) : 0;
  const maxBar = Math.max(declared, effective, 1);
  const barPx = (v: number) => Math.max(4, Math.round((v / maxBar) * 110));

  return (
    <div className="tl-anim-fadeup">
      {/* waterfall */}
      <div className="border-b border-white/[0.07] py-[34px]">
        <div className="mb-6 font-tl-mono text-[10px] tracking-[0.16em] text-ash">
          THE DISCOUNT — DECLARED {usdc(declared)} → EFFECTIVE {usdc(effective)}
          {discountPct > 0 ? ` (−${discountPct}%)` : ""}
        </div>
        <div className="flex h-[150px] items-end gap-0 overflow-x-auto">
          <div className="flex flex-[1.6_1.6_0%] flex-col justify-end gap-2">
            <div className="font-tl-serif text-xl font-semibold text-nectar">{usdc(declared)}</div>
            <div className="tl-rise rounded-t-[3px]" style={{ height: barPx(declared), background: "linear-gradient(#FFB020,rgba(255,176,32,.3))" }} />
            <div className="font-tl-mono text-[9px] tracking-[0.06em] text-[#8a8578]">DECLARED</div>
          </div>
          {buckets.map((b) => (
            <div key={b.key} className="flex flex-[0.9_0.9_0%] flex-col justify-end gap-2 px-1">
              <div className="truncate font-tl-mono text-[11px]" style={{ color: b.color }}>
                {usdc(b.usdc)}
              </div>
              <div
                className="tl-rise rounded-t-[3px]"
                style={{
                  height: barPx(b.usdc),
                  background: b.striped
                    ? "repeating-linear-gradient(45deg,#FF5C4D,#FF5C4D 3px,transparent 3px,transparent 7px)"
                    : "rgba(167,173,166,.4)",
                }}
              />
              <div className="font-tl-mono text-[9px] tracking-[0.06em] text-[#5a5f58]">{b.label}</div>
            </div>
          ))}
          <div className="flex flex-[1.3_1.3_0%] flex-col justify-end gap-2">
            <div className="font-tl-serif text-xl font-semibold text-ion">{usdc(effective)}</div>
            <div
              className="tl-rise rounded-t-[3px]"
              style={{ height: barPx(effective), background: "linear-gradient(#58F0C8,rgba(88,240,200,.35))", boxShadow: "0 0 20px rgba(88,240,200,.4)" }}
            />
            <div className="font-tl-mono text-[9px] tracking-[0.06em] text-[#4d8f7c]">EFFECTIVE</div>
          </div>
        </div>
      </div>

      {/* per-payer */}
      <div className="pt-[30px]">
        <div className="mb-2 font-tl-mono text-[10px] tracking-[0.16em] text-ash">
          PER-PAYER INDEPENDENCE
        </div>
        <div className="mb-5 font-tl-mono text-[11px] text-[#5a635e]">
          w = age × diversity × funding-independence × reciprocity
        </div>
        {ind && ind.perPayer.length > 0 ? (
          <div className="flex flex-col">
            {ind.perPayer.map((p) => (
              <PayerRow key={p.payer} p={p} />
            ))}
          </div>
        ) : (
          <p className="font-tl-mono text-sm text-[#5a635e]">
            No counterparties indexed in this window.
          </p>
        )}
      </div>
    </div>
  );
}

function PayerRow({ p }: { p: PayerWeight }) {
  const color = p.weight >= 0.66 ? "#58F0C8" : p.weight >= 0.2 ? "#FFB020" : "#FF5C4D";
  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3 border-t border-white/5 py-3 sm:grid-cols-[150px_1fr_120px_60px]">
      <span className="truncate font-tl-mono text-xs" style={{ color }}>
        {shortAddr(p.payer)}
      </span>
      <div className="h-[9px] overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="tl-grow h-full"
          style={{ width: `${Math.max(2, p.weight * 100)}%`, background: color, boxShadow: `0 0 8px ${color}55` }}
        />
      </div>
      <span className="col-span-2 truncate font-tl-mono text-[11px] text-[#5a635e] sm:col-span-1" title={p.reason}>
        {p.reason}
      </span>
      <span className="text-right font-tl-mono text-[13px] font-bold" style={{ color }}>
        {p.weight.toFixed(2)}
      </span>
    </div>
  );
}

// ---- rejected ----

function RejectDone({ result }: { result: UnderwritingResult }) {
  const s = result.score;
  const ind = result.independence;
  const declared = result.revenue.totalRevenueUsdc;
  const circ = ind?.circularPayers.length ?? 0;

  let reason: string;
  if (declared === 0 || result.revenue.distinctPayers === 0) {
    reason = "No x402 revenue indexed for this address in the scanned window. Nothing to underwrite yet.";
  } else if (circ > 0) {
    reason = `Declared ${usdc(declared)} → effective ${usdc(s.revenueUsdc)}. ${circ} payer${circ > 1 ? "s are" : " is"} funded by the agent within a few hops — circular funding collapses that revenue toward zero.`;
  } else if (!s.onchainCounts) {
    reason = `Only ${s.distinctPayers} distinct counterpart${s.distinctPayers === 1 ? "y" : "ies"} — below the ${s.minCounterparties}-payer anti-Sybil floor.`;
  } else {
    reason = `Declared ${usdc(declared)} → effective ${usdc(s.revenueUsdc)}. Remaining revenue is too fresh, too concentrated, or too undiversified to clear lending grade.`;
  }

  return (
    <div className="tl-anim-fadeup pt-10">
      <div className="rounded-xl border border-flare/40 bg-flare/[0.06] p-8">
        <div className="mb-[18px] flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-flare shadow-[0_0_12px_#FF5C4D]" />
          <span className="font-tl-mono text-sm font-bold tracking-[0.08em] text-flare">
            NOT LENDING GRADE
          </span>
        </div>
        <div className="max-w-[60ch] font-tl-serif text-lg leading-[1.6] text-bone">{reason}</div>
        <div className="mt-[26px] flex flex-wrap gap-6 border-t border-flare/20 pt-5 font-tl-mono text-xs text-ash">
          <span>
            counterparties: <span className="text-flare">{s.distinctPayers} / {s.minCounterparties} min</span>
          </span>
          <span>
            loop detection: <span className="text-flare">{circ > 0 ? "circular" : "clean"}</span>
          </span>
          {s.defaulted ? (
            <span>
              history: <span className="text-flare">defaulted</span>
            </span>
          ) : null}
        </div>
        <div className="mt-5 font-tl-mono text-xs leading-[1.6] text-[#5a635e]">
          The model bites — fake revenue earns no credit. Keep earning from
          independent payers to build a real signal.
        </div>
      </div>
    </div>
  );
}
