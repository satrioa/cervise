"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRupiah } from "@/lib/format";
import {
  annualSavings,
  calculateCustomMonthlyPrice,
  configFromPackageRow,
  normalizeCustomInput,
  yearlyPrice,
  type CustomPricingInput,
} from "@/lib/pricing/v2";
import { requestCustomQuote, type PublicPackage } from "@/lib/pricing/public";

type Period = "monthly" | "annual";

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP;

function priceFor(pkg: PublicPackage, period: Period) {
  if (pkg.code === "trial") return { amount: 0, cadence: `${pkg.trial_days ?? 5} hari gratis` };
  // Custom tidak menampilkan angka: harga dihitung dari kebutuhan tenant.
  if (pkg.code === "custom") return { amount: null, cadence: "Custom" };
  if (period === "monthly") return { amount: pkg.monthly_price, cadence: "/bulan" };
  const amount = pkg.annual_price ?? pkg.monthly_price * 10;
  return { amount, cadence: "/tahun" };
}

function featuresOf(pkg: PublicPackage) {
  return [
    `${pkg.branch_limit} cabang`,
    `${pkg.user_limit ?? "∞"} karyawan`,
    `${pkg.ticket_quota ?? 0} tiket servis/bulan`,
    `${pkg.whatsapp_quota ?? 0} pesan WhatsApp/bulan`,
    pkg.description ?? "Semua fitur utama",
  ];
}

export function PricingThreeTier({ packages }: { packages: PublicPackage[] }) {
  const [period, setPeriod] = useState<Period>("monthly");
  const trial = packages.find((p) => p.code === "trial");
  const custom = packages.find((p) => p.code === "custom");
  const paid = packages.filter((p) => p.code !== "trial" && p.code !== "custom");

  const config = custom ? configFromPackageRow(custom) : null;
  const [input, setInput] = useState<CustomPricingInput>({
    branches: 1,
    employees: 1,
    services: 0,
  });
  const [requesting, setRequesting] = useState(false);

  const preview = config
    ? calculateCustomMonthlyPrice(normalizeCustomInput(input), config)
    : null;
  const previewAnnual = preview ? yearlyPrice(preview.total, config!) : 0;

  const contactAdmin = async () => {
    if (!config) {
      toast.error("Paket Custom belum dikonfigurasi.");
      return;
    }
    setRequesting(true);
    try {
      const quote = await requestCustomQuote(input);
      if (!quote.ok || !quote.url) {
        toast.error(quote.message);
        return;
      }
      window.open(quote.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat penawaran");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="text-center">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Harga</div>
        <h2 className="mt-2 font-heading text-4xl tracking-tight md:text-5xl">Harga Simpel</h2>
        <p className="mx-auto mt-3 max-w-xl text-balance text-muted-foreground text-sm">
          Mulai gratis {trial?.trial_days ?? 5} hari. Bayar bulanan atau tahunan — kapasitas tetap di-reset tiap bulan. Upgrade kapan saja.
        </p>
        <div className="mt-6 inline-flex rounded-full border p-1">
          {(["monthly", "annual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                period === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {value === "monthly" ? "Bulanan" : "Tahunan — hemat ±17%"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-3 lg:grid-cols-4 lg:items-stretch">
        {packages.map((pkg) => {
          const { amount, cadence } = priceFor(pkg, period);
          const recommended = pkg.is_recommended;
          const isCustom = pkg.code === "custom";
          const savings =
            period === "annual" && pkg.code !== "trial"
              ? annualSavings(pkg.monthly_price, pkg.annual_price ?? pkg.monthly_price * 10)
              : 0;
          return (
            <div
              key={pkg.code}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                recommended
                  ? "border-foreground bg-foreground/[0.04] shadow-lg lg:scale-[1.02]"
                  : "border-border/60 bg-background/40"
              }`}
            >
              {recommended ? (
                <div className="-translate-x-1/2 absolute -top-3 left-1/2 inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 font-mono text-[10px] text-background uppercase tracking-[0.3em]">
                  <SparklesIcon className="size-3" /> Direkomendasikan
                </div>
              ) : null}
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">{pkg.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-heading text-3xl">
                  {pkg.code === "trial"
                    ? "Gratis"
                    : amount === null
                      ? "Custom"
                      : formatRupiah(amount)}
                </span>
                {pkg.code !== "trial" && amount !== null ? (
                  <span className="text-muted-foreground text-xs">{cadence}</span>
                ) : null}
              </div>
              {savings > 0 ? (
                <p className="mt-1 text-xs text-emerald-600">Hemat {formatRupiah(savings)} / tahun</p>
              ) : null}
              <p className="mt-2 text-muted-foreground text-sm">{pkg.description}</p>

              <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                {featuresOf(pkg).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <CheckIcon className={`mt-0.5 size-4 shrink-0 ${recommended ? "text-foreground" : "text-emerald-600"}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              {isCustom ? (
                <Button
                  size="lg"
                  variant={recommended ? "default" : "outline"}
                  className="mt-6 w-full"
                  render={<Link href="#kalkulator-custom">Hitung Custom</Link>}
                />
              ) : (
                <Button
                  size="lg"
                  variant={recommended ? "default" : "outline"}
                  className="mt-6 w-full"
                  render={
                    <Link
                      href={pkg.code === "trial" ? "/signup" : CONTACT ? `https://wa.me/${CONTACT.replace(/\D/g, "")}` : "#harga"}
                      target={pkg.code === "trial" ? undefined : "_blank"}
                    >
                      {pkg.code === "trial" ? "Mulai Trial" : "Pilih Paket"}
                    </Link>
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-16 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kapasitas</TableHead>
              {packages.map((pkg) => (
                <TableHead key={pkg.code} className="text-right">{pkg.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              ["Cabang", (p: PublicPackage) => `${p.branch_limit}`],
              ["Karyawan", (p: PublicPackage) => `${p.user_limit ?? "∞"}`],
              ["Tiket servis / bulan", (p: PublicPackage) => `${p.ticket_quota ?? 0}`],
              ["Pesan WhatsApp / bulan", (p: PublicPackage) => `${p.whatsapp_quota ?? 0}`],
              ["Durasi trial", (p: PublicPackage) => p.trial_days ? `${p.trial_days} hari` : "—"],
            ].map(([label, value]) => (
              <TableRow key={label as string}>
                <TableCell className="font-medium">{label as string}</TableCell>
                {packages.map((pkg) => (
                  <TableCell key={pkg.code} className="text-right">{(value as (p: PublicPackage) => string)(pkg)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {config && preview ? (
        <div id="kalkulator-custom" className="mt-16 rounded-2xl border p-6">
          <h3 className="font-heading text-2xl">Hitung Pay as You Grow</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Geser sesuai kebutuhan toko. Biaya tambahan baru dihitung di atas kapasitas Business.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex flex-col gap-5">
              {([
                ["branches", "Jumlah cabang", 1, 30, 1, "cabang"],
                ["employees", "Karyawan aktif", 1, 100, 1, "karyawan"],
                ["services", "Tiket servis / bulan", 0, 5000, 100, "tiket"],
              ] as const).map(([key, label, min, max, stepSize, unit]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                      {input[key]} {unit}
                    </span>
                  </div>
                  <Slider
                    value={input[key]}
                    onValueChange={(value) =>
                      setInput((current) => ({ ...current, [key]: value }))
                    }
                    min={min}
                    max={max}
                    step={stepSize}
                    thumbLabel={label}
                  />
                </div>
              ))}
              <div className="text-xs text-muted-foreground">
                Mulai dari 1 cabang, 1 karyawan, dan 0 tiket — tidak perlu mencapai batas paket Business.
              </div>
            </div>

            <div className="rounded-xl border p-4 text-sm">
              <div className="flex justify-between"><span>Cabang</span><span>{input.branches}</span></div>
              <div className="flex justify-between"><span>Karyawan</span><span>{input.employees}</span></div>
              <div className="flex justify-between"><span>Tiket / bulan</span><span>{input.services}</span></div>
              <div className="flex justify-between"><span>Kuota WA</span><span>{preview.whatsappQuota} pesan</span></div>
              <div className="mt-3 border-t pt-3 space-y-1">
                <div className="flex justify-between text-muted-foreground"><span>Harga dasar</span><span>{formatRupiah(preview.base)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Tambah cabang</span><span>{formatRupiah(preview.branchAddon)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Tambah karyawan</span><span>{formatRupiah(preview.employeeAddon)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Tambah {preview.extraServiceBlocks} blok tiket</span><span>{formatRupiah(preview.serviceAddon)}</span></div>
              </div>
              <div className="mt-3 border-t pt-3">
                <div className="flex justify-between font-medium"><span>Total bulanan</span><span>{formatRupiah(preview.total)}</span></div>
                <div className="flex justify-between font-medium"><span>Total tahunan</span><span>{formatRupiah(previewAnnual)}</span></div>
                <div className="flex justify-between text-emerald-600"><span>Hemat / tahun</span><span>{formatRupiah(annualSavings(preview.total, previewAnnual))}</span></div>
              </div>
              <Button size="lg" className="mt-4 w-full" loading={requesting} onClick={contactAdmin}>
                Konsultasi & Pesan Custom
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-10 text-center font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Bisa batal kapan saja</p>
    </div>
  );
}
