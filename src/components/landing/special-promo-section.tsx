"use client";

import { useEffect, useState } from "react";
import CloudSky from "@/components/originkit/ui/cloud-sky";
import { TiltCard } from "@/components/landing/tilt-card";
import { promoCountdown, type PromoCountdown } from "@/lib/pricing/promo";
import type { PublicPromo } from "@/lib/pricing/public";

function Countdown({ endsAt }: { endsAt: string }) {
  const [time, setTime] = useState<PromoCountdown | null>(null);

  useEffect(() => {
    const update = () => setTime(promoCountdown(endsAt));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (!time) return <div className="font-mono text-sm text-white/80">Memuat waktu promo…</div>;
  if (time.ended) return <div className="font-mono text-sm font-semibold text-white">Promo telah berakhir</div>;

  const cells = [
    { label: "hari", value: time.days },
    { label: "jam", value: time.hours },
    { label: "menit", value: time.minutes },
    { label: "detik", value: time.seconds },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Waktu promo tersisa">
      {cells.map((cell) => (
        <span key={cell.label} className="flex min-w-14 flex-col items-center rounded-lg bg-white/15 px-3 py-2 text-white backdrop-blur">
          <span className="font-mono text-lg font-semibold tabular-nums leading-none">{String(cell.value).padStart(2, "0")}</span>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-white/80">{cell.label}</span>
        </span>
      ))}
    </div>
  );
}

export function SpecialPromoSection({ promo }: { promo: PublicPromo }) {
  return (
    <section className="relative isolate overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
      <div aria-hidden className="absolute inset-0 -z-10">
        <CloudSky style={{ position: "absolute", inset: 0, minWidth: 0, minHeight: 0, width: "100%", height: "100%" }} />
      </div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-slate-950/45" />

      <div className="mx-auto max-w-5xl [perspective:1200px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="font-heading text-3xl font-bold text-white sm:text-4xl">{promo.promo_title}</h2>
          <Countdown endsAt={promo.promo_ends_at} />
        </div>

        <TiltCard className="mt-10 rounded-2xl border border-white/20 bg-white/95 p-6 shadow-2xl sm:p-8">
          <div className="text-center">
            <h3 className="font-heading text-2xl font-semibold text-slate-900 sm:text-3xl">{promo.promo_headline}</h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">{promo.promo_subtext}</p>
            <div className="mt-5 font-heading text-3xl font-bold text-slate-900 sm:text-4xl">{promo.promo_price}</div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">What&apos;s included</h4>
              <ul className="mt-3 space-y-2">
                {promo.promo_included.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Separate charges</h4>
              <ul className="mt-3 space-y-2">
                {promo.promo_separate.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-8 border-t border-slate-200 pt-4 text-center text-xs leading-relaxed text-slate-500">
            {promo.promo_note}
          </p>
        </TiltCard>
      </div>
    </section>
  );
}

export default SpecialPromoSection;
