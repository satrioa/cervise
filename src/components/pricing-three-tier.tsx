"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { DEFAULT_TRIAL_DAYS } from "@/lib/pricing/trial-days";

type Period = "monthly" | "annual";

function priceFor(pkg: PublicPackage, period: Period) {
  if (pkg.code === "trial") return { amount: 0, cadence: `${pkg.trial_days ?? DEFAULT_TRIAL_DAYS} hari gratis` };
  // Custom tidak menampilkan angka: harga dihitung dari kebutuhan tenant.
  if (pkg.code === "custom") return { amount: null, cadence: "Custom" };
  if (period === "monthly") return { amount: pkg.monthly_price, cadence: "/bulan" };
  const amount = pkg.annual_price ?? pkg.monthly_price * 10;
  return { amount, cadence: "/tahun" };
}

// Poin kartu sengaja tanpa angka kapasitas -- angka itu berubah sesuai paket
// dan sudah tersedia di tabel perbandingan di bawah kartu.
function featuresOf(pkg: PublicPackage) {
  return [
    "Cabang sesuai kebutuhan",
    "Tim kerja yang terjangkau",
    "Kapasitas servis bulanan",
    "Notifikasi WhatsApp otomatis",
    pkg.description ?? "Semua fitur utama",
  ];
}

/** Baris tabel perbandingan: kapasitas dari data paket, fitur platform berlaku untuk semua. */
const capacity = (p: PublicPackage, value: string) => (p.code === "custom" ? "custom" : value);
const available = <CheckIcon className="ml-auto size-4 text-emerald-600" aria-label="Tersedia" />;

type FeatureRow = { label: string; render: (p: PublicPackage) => ReactNode };
type FeatureGroup = { label: string; rows: FeatureRow[] };

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    label: "Kapasitas",
    rows: [
      { label: "Cabang", render: (p) => capacity(p, `${p.branch_limit}`) },
      { label: "Karyawan", render: (p) => capacity(p, `${p.user_limit ?? "∞"}`) },
      { label: "Tiket servis / bulan", render: (p) => capacity(p, `${p.ticket_quota ?? "∞"}`) },
      { label: "Pesan WhatsApp / bulan", render: (p) => capacity(p, `${p.whatsapp_quota ?? 0}`) },
    ],
  },
  {
    label: "Operasional",
    rows: [
      { label: "POS", render: () => available },
      { label: "Manajemen Servis", render: () => available },
      { label: "Manajemen Sparepart", render: () => available },
      { label: "Manajemen Inventori", render: () => available },
    ],
  },
  {
    label: "Pelanggan & Garansi",
    rows: [
      { label: "Data Customer", render: () => available },
      { label: "Garansi", render: () => available },
      { label: "Portal Lacak Servis", render: () => available },
    ],
  },
  {
    label: "Keuangan & Laporan",
    rows: [
      { label: "Laporan Keuangan & Servis", render: () => available },
      { label: "Laporan Penjualan", render: () => available },
      { label: "Arus Kas", render: () => available },
    ],
  },
  {
    label: "Akses & Pendukung",
    rows: [
      { label: "Karyawan & Role", render: () => available },
      { label: "Multi-Cabang", render: () => available },
      { label: "Notifikasi WhatsApp", render: () => available },
    ],
  },
];

function GroupRows({ group, packages }: { group: FeatureGroup; packages: PublicPackage[] }) {
  return (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell
          colSpan={packages.length + 1}
          className="py-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
        >
          {group.label}
        </TableCell>
      </TableRow>
      {group.rows.map((row) => (
        <TableRow key={row.label}>
          <TableCell className="sticky left-0 z-10 bg-background font-medium">{row.label}</TableCell>
          {packages.map((pkg) => (
            <TableCell key={pkg.code} className="text-right">{row.render(pkg)}</TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function PricingThreeTier({ packages, isLoggedIn }: { packages: PublicPackage[]; isLoggedIn: boolean }) {
  const [period, setPeriod] = useState<Period>("monthly");
  const [calculatorPeriod, setCalculatorPeriod] = useState<Period>("monthly");
  const trial = packages.find((p) => p.code === "trial");
  const custom = packages.find((p) => p.code === "custom");
  const paid = packages.filter((p) => p.code !== "trial" && p.code !== "custom");

  const config = custom ? configFromPackageRow(custom) : null;
  const [input, setInput] = useState<CustomPricingInput>({
    branches: config?.includedBranches ?? 1,
    services: config?.includedServices ?? 100,
  });
  const [requesting, setRequesting] = useState(false);

  const preview = config
    ? calculateCustomMonthlyPrice(normalizeCustomInput(input, config), config)
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
        <h2 className="mt-2 font-heading text-4xl tracking-tight md:text-5xl">Harga Transparan &amp; Fleksibel</h2>
        <p className="mx-auto mt-3 max-w-xl text-balance text-muted-foreground text-sm">
          Mulai gratis {trial?.trial_days ?? DEFAULT_TRIAL_DAYS} hari. Bayar bulanan atau tahunan — kapasitas tetap di-reset tiap bulan. Upgrade kapan saja.
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
          const annualEquivalent = pkg.annual_price ?? pkg.monthly_price * 10;
          const savings =
            period === "annual" && pkg.code !== "trial"
              ? annualSavings(pkg.monthly_price, annualEquivalent)
              : 0;
          const savingsPercent = Math.round(
            (1 - annualEquivalent / Math.max(1, pkg.monthly_price * 12)) * 100,
          );
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
              {period === "annual" && (savings > 0 || isCustom) ? (
                <p className="mt-1 text-xs text-emerald-600">
                  {isCustom
                    ? `Hemat ${savingsPercent}%`
                    : `Hemat ${formatRupiah(savings)} / tahun`}
                </p>
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
                      href={
                        pkg.code === "trial" || !isLoggedIn
                          ? "/signup"
                          : "/app/pengaturan/subscription"
                      }
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

      <Card className="mt-16">
        <CardHeader>
          <CardTitle>Bandingkan Fitur</CardTitle>
          <CardDescription>Bandingkan kapasitas dan fitur tiap paket. Pilih yang paling pas untuk toko Anda.</CardDescription>
        </CardHeader>
        <CardPanel className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-background">Kapasitas &amp; Fitur</TableHead>
                {packages.map((pkg) => (
                  <TableHead key={pkg.code} className="text-right">{pkg.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {FEATURE_GROUPS.map((group) => (
                <GroupRows key={group.label} group={group} packages={packages} />
              ))}
            </TableBody>
          </Table>
        </CardPanel>
      </Card>

      {config && preview ? (
        <div id="kalkulator-custom" className="mt-16 rounded-2xl border p-6">
          <h3 className="font-heading text-2xl">Hitung Pay as You Grow</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Mulai dari kapasitas paket Starter. Tambahan dihitung untuk setiap kebutuhan di atasnya.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex flex-col gap-5">
              {([
                ["branches", "Jumlah cabang", config?.includedBranches ?? 1, 30, 1, "cabang"],
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
                Minimum: {config?.includedBranches ?? 1} cabang.
              </div>
            </div>

            <div className="rounded-xl border p-4 text-sm">
              <Tabs
                value={calculatorPeriod}
                onValueChange={(value) => setCalculatorPeriod(value as Period)}
                className="mb-4"
              >
                <TabsList className="w-full">
                  <TabsTrigger value="monthly">Bulanan</TabsTrigger>
                  <TabsTrigger value="annual">Tahunan</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex justify-between"><span>Cabang</span><span>{input.branches}</span></div>
              <div className="flex justify-between"><span>Kuota WA</span><span>{preview.whatsappQuota} pesan</span></div>
              <div className="mt-3 border-t pt-3 space-y-1">
                <div className="text-xs text-muted-foreground">Rincian bulanan</div>
                <div className="flex justify-between text-muted-foreground"><span>Harga dasar</span><span>{formatRupiah(preview.base)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Tambah cabang</span><span>{formatRupiah(preview.branchAddon)}</span></div>
              </div>
              <div className="mt-3 border-t pt-3">
                <div className="flex justify-between font-medium">
                  <span>{calculatorPeriod === "annual" ? "Total tahunan" : "Total bulanan"}</span>
                  <span>{formatRupiah(calculatorPeriod === "annual" ? previewAnnual : preview.total)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{calculatorPeriod === "annual" ? "/tahun" : "/bulan"}</span>
                </div>
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
