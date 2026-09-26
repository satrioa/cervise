"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  MoreHorizontalIcon,
  PlusIcon,
  TrendingUpIcon,
  StoreIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CerviseAnalyticsSection } from "@/components/dashboards-analytics";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ServisForm } from "@/components/servis/servis-form";
import { useBranch } from "@/lib/branch-context";
import { createClient } from "@/lib/supabase/client";

type Period = "hari ini" | "7d" | "30d" | "90d";

const BRANCH_FACTOR: Record<string, number> = {
  all: 1,
  pusat: 0.42,
  cab2: 0.28,
  cab3: 0.18,
  express: 0.07,
  mitra: 0.05,
};

function getSparkForPeriod(period: Period, factor: number): number[] {
  let base: number[];
  if (period === "hari ini") base = [2, 4, 3, 6, 5, 9, 7, 12];
  else if (period === "7d") base = [8, 12, 10, 18, 15, 22, 20];
  else if (period === "90d") base = [18, 28, 35, 42, 50, 62, 70, 78, 85, 92, 98, 105];
  else base = [2, 3, 5, 4, 6, 5, 8, 7, 9, 8, 10, 18, 22, 19, 28, 24, 31, 35, 30, 38, 41, 36, 44, 48, 52, 46, 54, 58, 53, 61];
  // deterministic: no Math.random (hydration mismatch), use index-based jitter
  return base.map((v, i) => Math.max(1, Math.round(v * factor + Math.sin(i * 12.9898) * 0.6)));
}

export default function DashboardPage() {
  const { branch } = useBranch();
  const [period, setPeriod] = useState<Period>("30d");
  const [openServis, setOpenServis] = useState(false);

  // supabase live data (fallback to deterministic mock to avoid hydration mismatch)
  const [live, setLive] = useState<{
    totalServis: number;
    pending: number;
    omzet: number;
    pengeluaran: number;
    garansiAktif: number;
    recentServis: { device: string; status: string; created_at: string }[];
  }>({
    totalServis: 1261,
    pending: 12,
    omzet: 4520000,
    pengeluaran: 1200000,
    garansiAktif: 84,
    recentServis: [
      { device: "iPhone 14 Pro", status: "Masuk", created_at: "2026-09-22T10:00:00.000Z" },
      { device: "Samsung A54", status: "Diagnosa", created_at: "2026-09-22T09:30:00.000Z" },
      { device: "Oppo Reno 8", status: "Selesai", created_at: "2026-09-22T08:00:00.000Z" },
    ],
  });

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const [{ count: totalServis }, { data: pending }, { data: finance }, { count: garansiAktif }, { data: recentServis }] =
          await Promise.all([
            supabase.from("cervise_services").select("*", { count: "exact", head: true }),
            supabase.from("cervise_services").select("id").eq("status", "Menunggu Konfirmasi"),
            supabase.from("cervise_finance_tx").select("amount,type").eq("kas_date", new Date().toISOString().slice(0, 10)),
            supabase.from("cervise_services").select("*", { count: "exact", head: true }).gte("garansi_until", new Date().toISOString()),
            supabase.from("cervise_services").select("device,status,created_at").order("created_at", { ascending: false }).limit(5),
          ]);
        if (typeof totalServis === "number" || pending || finance || typeof garansiAktif === "number" || recentServis) {
          const omzet = (finance || []).filter((f: { type: string }) => f.type === "pemasukan").reduce((a: number, b: { amount: number }) => a + Number(b.amount), 0);
          const pengeluaran = (finance || []).filter((f: { type: string }) => f.type === "pengeluaran").reduce((a: number, b: { amount: number }) => a + Number(b.amount), 0);
          setLive((prev) => ({
            totalServis: totalServis ?? prev.totalServis,
            pending: pending?.length ?? prev.pending,
            omzet: omzet || prev.omzet,
            pengeluaran: pengeluaran || prev.pengeluaran,
            garansiAktif: garansiAktif ?? prev.garansiAktif,
            recentServis: (recentServis as { device: string; status: string; created_at: string }[]) || prev.recentServis,
          }));
        }
      } catch {
        // keep mock
      }
    })();
  }, []);

  const factor = BRANCH_FACTOR[branch.id] ?? 1;

  // stats are now period-aware
  const stats = useMemo(() => {
    // scale by period: hari ini = ~1/30 of 30d, 7d = ~0.23, 90d = ~3x
    const periodScale: Record<Period, number> = {
      "hari ini": 0.04,
      "7d": 0.23,
      "30d": 1,
      "90d": 2.8,
    };
    const scale = periodScale[period] * factor;
    const total = Math.max(1, Math.round(live.totalServis * scale));
    const pendingScaled = Math.max(0, Math.round(live.pending * Math.min(1, scale * 1.2)));
    const omzetScaled = Math.round(live.omzet * scale);
    const keluarScaled = Math.round(live.pengeluaran * scale);
    const garansiScaled = Math.max(1, Math.round(live.garansiAktif * (branch.id === "all" ? 1 : 0.6) * (period === "hari ini" ? 0.08 : period === "7d" ? 0.35 : period === "90d" ? 1.8 : 1)));

    const periodLabel: Record<Period, string> = {
      "hari ini": "hari ini",
      "7d": "7 hari",
      "30d": "30 hari",
      "90d": "90 hari",
    };

    return [
      { label: "Total servis", value: String(total), delta: `${pendingScaled} pending`, trend: "up" as const, sub: periodLabel[period] },
      {
        label: period === "hari ini" ? "Omzet hari ini" : `Omzet ${period}`,
        value: `Rp ${(omzetScaled / 1000).toFixed(0)}k`,
        delta: `+${period === "hari ini" ? "2.1%" : period === "7d" ? "5.4%" : period === "90d" ? "12.8%" : "8.2%"}`,
        trend: "up" as const,
        sub: `Keluar Rp ${(keluarScaled / 1000).toFixed(0)}k`,
      },
      { label: "Garansi aktif", value: String(garansiScaled), delta: "3 bln", trend: "up" as const, sub: "auto 90 hari" },
      {
        label: "Menunggu konfirmasi",
        value: String(pendingScaled),
        delta: pendingScaled > 0 ? "-follow up" : "aman",
        trend: pendingScaled > 0 ? ("down" as const) : ("up" as const),
        sub: branch.label === "Semua cabang" ? "Semua cabang" : branch.label,
      },
    ];
  }, [live, factor, period, branch.label]);

  const spark = useMemo(() => getSparkForPeriod(period, factor), [period, factor]);
  const sparkTotal = useMemo(() => spark.reduce((a, b) => a + b, 0), [spark]);

  const activity = useMemo(
    () =>
      live.recentServis.map((s) => ({
        who: s.device.split(" ")[0] || "Servis",
        what: s.status.toLowerCase(),
        target: s.device,
        time: new Date(s.created_at).toLocaleDateString("id-ID"),
      })),
    [live.recentServis]
  );

  return (
    <div className="bg-background text-foreground">
      <PageHeader
        title="Overview"
        titleClassName="font-heading text-2xl"
        actions={
          <Button size="sm" type="button" className="h-8 shrink-0" onClick={() => setOpenServis(true)}>
            <PlusIcon />
            Servis Baru
          </Button>
        }
        filters={<PeriodFilter period={period} setPeriod={setPeriod} branchLabel={branch.label} />}
      />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <ChartCard data={spark} total={String(sparkTotal)} period={period} />
          <ActivityCard items={activity} />
        </div>
      </main>

      <CerviseAnalyticsSection period={period} />

      <DialogPrimitive.Root open={openServis} onOpenChange={setOpenServis}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[95vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-background shadow-xl">
            <div className="overflow-y-auto p-6">
              <ServisForm onSuccess={() => setOpenServis(false)} onCancel={() => setOpenServis(false)} />
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Tutup">
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}

function PeriodFilter({
  period,
  setPeriod,
  branchLabel,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
  branchLabel: string;
}) {
  const opts: Period[] = ["hari ini", "7d", "30d", "90d"];
  return (
    <div className="flex items-center rounded-md border border-border/70 bg-background/40 font-mono text-xs text-muted-foreground overflow-hidden w-full sm:w-auto">
      <div className="flex items-center flex-1 sm:flex-none">
        {opts.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setPeriod(o)}
            className={`px-2.5 py-1.5 capitalize transition-colors whitespace-nowrap flex-1 sm:flex-none ${
              period === o ? "bg-foreground/[0.08] text-foreground" : "hover:text-foreground"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      <span className="mx-1 h-4 w-px bg-border/60 shrink-0 hidden sm:block" />
      <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-foreground whitespace-nowrap">
        <StoreIcon className="size-3 opacity-70" />
        {branchLabel}
      </span>
      {/* mobile branch label below period on small screens */}
      <span className="sm:hidden flex items-center gap-1 px-2 text-[11px] text-muted-foreground border-l border-border/60 ml-1">
        <StoreIcon className="size-3" />
        <span className="truncate max-w-[110px]">{branchLabel}</span>
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  trend,
  sub,
}: {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  sub: string;
}) {
  const Up = trend === "up";
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">{label}</div>
        <button type="button" className="text-muted-foreground/60 transition-colors hover:text-foreground">
          <MoreHorizontalIcon className="size-4" />
        </button>
      </div>
      <div className="mt-2 font-heading text-3xl tracking-tight">{value}</div>
      <div className="mt-1 flex items-center gap-1.5 text-xs">
        <span
          className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] ${Up ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/12 text-rose-600 dark:text-rose-400"}`}
        >
          {Up ? <ArrowUpRightIcon className="size-3" /> : <ArrowDownRightIcon className="size-3" />}
          {delta}
        </span>
        <span className="text-muted-foreground">{sub}</span>
      </div>
    </div>
  );
}

function ChartCard({ data, total, period }: { data: number[]; total: string; period: Period }) {
  const periodTitle: Record<Period, string> = {
    "hari ini": "Hari ini · per jam",
    "7d": "7 hari terakhir",
    "30d": "30 hari terakhir",
    "90d": "90 hari terakhir",
  };
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-5 lg:col-span-2">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Servis masuk · harian</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-heading text-2xl">{total}</span>
            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/12 px-1.5 py-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
              <TrendingUpIcon className="size-3" />
              {periodTitle[period]}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-6 h-44 w-full">
        <Sparkline data={data} />
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const W = 600, H = 160, PAD = 8;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const stepX = (W - PAD * 2) / (data.length - 1);
  const points = data.map((v, i) => `${PAD + i * stepX},${PAD + (1 - (v - min) / range) * (H - PAD * 2)}`).join(" ");
  const area = `M ${PAD} ${H - PAD} L ${points.split(" ").join(" L ")} L ${W - PAD} ${H - PAD} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="dash-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#dash-grad)" className="text-primary" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
      {data.map((v, i) => {
        const x = PAD + i * stepX, y = PAD + (1 - (v - min) / range) * (H - PAD * 2);
        const last = i === data.length - 1;
        return last ? (
          <g key={i}>
            <circle cx={x} cy={y} r="6" className="text-primary opacity-25" fill="currentColor" />
            <circle cx={x} cy={y} r="2.5" className="text-primary" fill="currentColor" />
          </g>
        ) : null;
      })}
    </svg>
  );
}

function ActivityCard({ items }: { items: { who: string; what: string; target: string; time: string }[] }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-5">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Recent activity</div>
        <button type="button" className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] transition-colors hover:text-foreground">
          See all
        </button>
      </div>
      <ul className="mt-4 flex flex-col gap-3.5">
        {items.length === 0 ? (
          <li className="text-sm text-muted-foreground">Belum ada aktivitas</li>
        ) : (
          items.map((a, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="mt-1 flex size-6 items-center justify-center rounded-full bg-foreground/[0.06] font-medium text-[10px]">{a.who[0]}</span>
              <div className="min-w-0 flex-1 leading-snug">
                <span className="font-medium">{a.who}</span> <span className="text-muted-foreground">{a.what}</span>{" "}
                <span className="text-foreground/85">{a.target}</span>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-[0.2em]">{a.time} ago</div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
