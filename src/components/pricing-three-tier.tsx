import Link from "next/link";
import { CheckIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLANS = [
  {
    id: "trial",
    name: "Trial",
    price: "Rp 0",
    cadence: "14 hari gratis",
    blurb: "Coba semua fitur tanpa kartu kredit.",
    features: ["1 cabang, 3 user", "Semua fitur", "Garansi 3 bulan", "PWA ringan di HP"],
    cta: "Mulai Trial",
    href: "/app",
    external: false,
    primary: false,
  },
  {
    id: "basic",
    name: "Basic",
    price: "Rp 199rb",
    cadence: "/bulan",
    blurb: "Untuk 1 toko yang butuh operasional harian.",
    features: ["1 cabang, 3 user", "Kas & Laporan per cabang", "Notifikasi WA Fonnte", "Isolasi data per cabang"],
    cta: "Pilih Paket",
    href: "https://wa.me/6280000000000",
    external: true,
    primary: true,
    badge: "Paling Laris",
  },
  {
    id: "pro",
    name: "Pro",
    price: "Rp 499rb",
    cadence: "/bulan",
    blurb: "Untuk multi-cabang dengan rekap owner.",
    features: ["3 cabang, 15 user", "Rekap konsolidasi owner", "Prioritas support", "Export Excel/PDF"],
    cta: "Pilih Paket",
    href: "https://wa.me/6280000000000",
    external: true,
    primary: false,
  },
] as const;

export function PricingThreeTier() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="text-center">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Harga</div>
        <h2 className="mt-2 font-heading text-4xl tracking-tight md:text-5xl">Harga Simpel</h2>
        <p className="mx-auto mt-3 max-w-xl text-balance text-muted-foreground text-sm">
          Trial 14 hari gratis. Konfirmasi transfer manual via WhatsApp. Upgrade kapan saja — pro-rata.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-3 lg:grid-cols-3 lg:items-stretch">
        {PLANS.map((p) => (
          <div
            key={p.id}
            className={`relative flex flex-col rounded-2xl border p-6 ${
              p.primary ? "border-foreground bg-foreground/[0.04] shadow-lg lg:scale-[1.02]" : "border-border/60 bg-background/40"
            }`}
          >
            {"badge" in p && (p as { badge?: string }).badge ? (
              <div className="-translate-x-1/2 absolute -top-3 left-1/2 inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 font-mono text-[10px] text-background uppercase tracking-[0.3em]">
                <SparklesIcon className="size-3" />
                {(p as { badge?: string }).badge}
              </div>
            ) : null}
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">{p.name}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-heading text-4xl">{p.price}</span>
              <span className="text-muted-foreground text-xs">{p.cadence}</span>
            </div>
            <p className="mt-2 text-muted-foreground text-sm">{p.blurb}</p>

            <ul className="mt-6 flex flex-1 flex-col gap-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckIcon className={`mt-0.5 size-4 shrink-0 ${p.primary ? "text-foreground" : "text-emerald-600 dark:text-emerald-400"}`} />
                  {f}
                </li>
              ))}
            </ul>

            <Button
              size="lg"
              variant={p.primary ? "default" : "outline"}
              className="mt-6 w-full"
              render={<Link href={p.href} target={p.external ? "_blank" : undefined}>{p.cta}</Link>}
            />
          </div>
        ))}
      </div>

      <p className="mt-10 text-center font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Semua harga dalam Rupiah · Konfirmasi manual · Batal kapan saja</p>
    </div>
  );
}
