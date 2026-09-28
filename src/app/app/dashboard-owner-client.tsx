"use client";

import { useState, useEffect } from "react";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  MoreHorizontalIcon,
  PlusIcon,
  StoreIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CerviseAnalyticsSection } from "@/components/dashboards-analytics";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ServisForm } from "@/components/servis/servis-form";
import { useBranch } from "@/lib/branch-context";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { getDashboardData, type DashboardData } from "@/app/app/actions";
import { DASHBOARD_PERIODS, type DashboardPeriod } from "@/lib/operational/dashboard";

const PERIOD_LABEL: Record<DashboardPeriod, string> = {
  "hari ini": "hari ini",
  "7d": "7 hari",
  "30d": "30 hari",
  "90d": "90 hari",
};

export default function DashboardPage() {
  const { branch } = useBranch();
  const [period, setPeriod] = useState<DashboardPeriod>("30d");
  const [openServis, setOpenServis] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset during render whenever the branch or period changes, so the effect
  // body only performs the fetch and never sets state synchronously.
  const fetchKey = `${branch.id}:${period}`;
  const [loadedKey, setLoadedKey] = useState(fetchKey);
  if (loadedKey !== fetchKey) {
    setLoadedKey(fetchKey);
    setData(null);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    getDashboardData(period)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Gagal memuat data dashboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchKey, period]);

  const summary = data?.summary;
  const bucketSeries = summary ? summary.buckets.map((bucket) => bucket.masuk) : [];

  const cards = summary
    ? [
        {
          label: "Total servis",
          value: formatNumberPlain(summary.totalServis),
          delta: `${formatNumberPlain(summary.pendingKonfirmasi)} menunggu`,
          trend: "neutral" as const,
          sub: PERIOD_LABEL[period],
        },
        {
          label: `Omzet ${PERIOD_LABEL[period]}`,
          value: formatCurrencyPlain(summary.omzet),
          delta: `Keluar ${formatCurrencyPlain(summary.pengeluaran)}`,
          trend: summary.omzet >= summary.pengeluaran ? ("up" as const) : ("down" as const),
          sub: data?.branchLabel ?? branch.label,
        },
        {
          label: "Garansi aktif",
          value: formatNumberPlain(summary.garansiAktif),
          delta: "berlaku",
          trend: "neutral" as const,
          sub: "belum expired",
        },
        {
          label: "Menunggu konfirmasi",
          value: formatNumberPlain(summary.pendingKonfirmasi),
          delta: summary.pendingKonfirmasi > 0 ? "perlu follow up" : "aman",
          trend: summary.pendingKonfirmasi > 0 ? ("down" as const) : ("up" as const),
          sub: data?.branchLabel ?? branch.label,
        },
      ]
    : [];

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
        filters={<PeriodFilter period={period} setPeriod={setPeriod} branchLabel={data?.branchLabel ?? branch.label} />}
      />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8">
        {error ? (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {loading && !summary
            ? Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-[104px] animate-pulse rounded-xl border border-border/60 bg-background/40" />
              ))
            : cards.map((card) => (
                <StatCard key={card.label} {...card} />
              ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <ChartCard data={bucketSeries} total={summary ? formatNumberPlain(summary.bucketTotal) : "0"} period={period} loading={loading && !summary} />
          <ActivityCard items={data?.recent ?? []} loading={loading && !data} />
        </div>
      </main>

      <CerviseAnalyticsSection
        period={period}
        buckets={summary?.buckets ?? []}
        technicians={data?.technicians ?? []}
        problems={data?.problems ?? []}
        branches={data?.branches ?? []}
        loading={loading && !data}
      />

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
  period: DashboardPeriod;
  setPeriod: (p: DashboardPeriod) => void;
  branchLabel: string;
}) {
  return (
    <div className="flex items-center rounded-md border border-border/70 bg-background/40 font-mono text-xs text-muted-foreground overflow-hidden w-full sm:w-auto">
      <div className="flex items-center flex-1 sm:flex-none">
        {DASHBOARD_PERIODS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setPeriod(option)}
            className={`px-2.5 py-1.5 capitalize transition-colors whitespace-nowrap flex-1 sm:flex-none ${
              period === option ? "bg-foreground/[0.08] text-foreground" : "hover:text-foreground"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <span className="mx-1 h-4 w-px border-border/60 shrink-0 hidden sm:block" />
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
  trend: "up" | "down" | "neutral";
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
        {trend === "neutral" ? (
          <span className="inline-flex items-center gap-0.5 rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {delta}
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] ${Up ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/12 text-rose-600 dark:text-rose-400"}`}
          >
            {Up ? <ArrowUpRightIcon className="size-3" /> : <ArrowDownRightIcon className="size-3" />}
            {delta}
          </span>
        )}
        <span className="text-muted-foreground">{sub}</span>
      </div>
    </div>
  );
}

function ChartCard({ data, total, period, loading }: { data: number[]; total: string; period: DashboardPeriod; loading: boolean }) {
  const periodTitle: Record<DashboardPeriod, string> = {
    "hari ini": "Hari ini · per jam",
    "7d": "7 hari terakhir",
    "30d": "30 hari terakhir",
    "90d": "90 hari terakhir",
  };
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-5 lg:col-span-2">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Servis masuk · {period === "hari ini" ? "per jam" : period === "90d" ? "per minggu" : "harian"}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-heading text-2xl">{total}</span>
            <span className="inline-flex items-center gap-0.5 rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {periodTitle[period]}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-6 h-44 w-full">
        {loading ? (
          <div className="h-full w-full animate-pulse rounded-lg bg-foreground/[0.04]" />
        ) : data.length > 0 ? (
          <Sparkline data={data} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Belum ada servis masuk</div>
        )}
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

function ActivityCard({ items, loading }: { items: { id: string; device: string; status: string; customer: string; createdAt: string }[]; loading: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-5">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Recent activity</div>
      </div>
      <ul className="mt-4 flex flex-col gap-3.5">
        {loading ? (
          <li className="text-sm text-muted-foreground">Memuat…</li>
        ) : items.length === 0 ? (
          <li className="text-sm text-muted-foreground">Belum ada aktivitas</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1 flex size-6 items-center justify-center rounded-full bg-foreground/[0.06] font-medium text-[10px]">
                {(item.customer || item.device).slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1 leading-snug">
                <span className="font-medium">{item.customer}</span>{" "}
                <span className="text-muted-foreground">{item.status.toLowerCase()}</span>{" "}
                <span className="text-foreground/85">{item.device}</span>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-[0.2em]">
                  {new Date(item.createdAt).toLocaleDateString("id-ID")}
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
