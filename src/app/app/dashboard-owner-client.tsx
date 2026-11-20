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
import { Area, AreaChart } from "recharts";
import { BarSparkline } from "@/components/charts/sparkline";
import { Button } from "@/components/ui/button";
import { ChartSkeleton } from "@/components/ui/skeleton-shapes";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartAxis, ChartContainer, ChartGrid, ChartTooltip, chartColor } from "@/components/chart";
import { EvilComposedChart } from "@/components/evilcharts/charts/recharts-composed-chart";
import type { ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import { KaggoAnalyticsSection } from "@/components/dashboards-analytics";
import ActivityCard from "@/components/dashboard/activity-card";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ServisForm } from "@/components/servis/servis-form";
import { useBranch } from "@/lib/branch-context";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { getDashboardData, type DashboardData } from "@/app/app/actions";
import {
  DASHBOARD_PERIODS,
  type DashboardBucket,
  type DashboardPeriod,
} from "@/lib/operational/dashboard";

const PERIOD_LABEL: Record<DashboardPeriod, string> = {
  "hari ini": "hari ini",
  "7d": "7 hari",
  "30d": "30 hari",
  "90d": "90 hari",
};

export default function DashboardOwnerClient() {
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

  const omzetChange = (() => {
    if (!data || !summary) return { delta: "", trend: "neutral" as const };
    const previous = data.previousOmzet;
    if (previous <= 0) return { delta: "Belum ada data sebelumnya", trend: "neutral" as const };
    const pct = Math.round(((summary.omzet - previous) / previous) * 100);
    const comparison = period === "hari ini" ? "dibandingkan kemarin" : `dibanding ${PERIOD_LABEL[period]} sebelumnya`;
    return {
      delta: `${pct >= 0 ? "Naik" : "Turun"} ${Math.abs(pct)}% ${comparison}`,
      trend: (pct >= 0 ? "up" : "down") as "up" | "down",
    };
  })();

  const cards = summary
    ? [
        {
          label: "Total servis",
          value: formatNumberPlain(summary.totalServis),
          delta: `${formatNumberPlain(summary.pendingKonfirmasi)} menunggu`,
          trend: "neutral" as const,
          sub: PERIOD_LABEL[period],
          sparkline: summary.buckets.map((b) => b.masuk),
        },
        {
          label: `Omzet ${PERIOD_LABEL[period]}`,
          value: formatCurrencyPlain(summary.omzet),
          delta: omzetChange.delta,
          trend: omzetChange.trend,
          sub: data?.branchLabel ?? branch.label,
          sparkline: summary.buckets.map((b) => b.masuk),
        },
        {
          label: "Garansi aktif",
          value: formatNumberPlain(summary.garansiAktif),
          delta: "berlaku",
          trend: "neutral" as const,
          sub: "belum expired",
          sparkline: summary.buckets.map((b) => b.masuk),
        },
        {
          label: "Menunggu konfirmasi",
          value: formatNumberPlain(summary.pendingKonfirmasi),
          delta: summary.pendingKonfirmasi > 0 ? "perlu follow up" : "aman",
          trend: summary.pendingKonfirmasi > 0 ? ("down" as const) : ("up" as const),
          sub: data?.branchLabel ?? branch.label,
          sparkline: summary.buckets.map((b) => b.masuk),
        },
      ]
    : [];

  return (
    <div className="bg-white text-foreground dark:bg-[#0f0f0f]">
      <PageHeader
        title="Overview"
        titleClassName="font-heading text-2xl"
        actions={undefined}
        filters={<PeriodFilter period={period} setPeriod={setPeriod} branchLabel={data?.branchLabel ?? branch.label} />}
        filterCount={period !== "30d" ? 1 : 0}
        filterSummary={period !== "30d" ? `Periode: ${period}` : undefined}
        onClearFilters={() => setPeriod("30d")}
      />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {error ? (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {loading && !summary
            ? Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  aria-hidden
                  className="rounded-xl border border-border/60 bg-background/40 p-4"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-2.5 w-24" />
                    <Skeleton className="size-4 rounded-full" />
                  </div>
                  <Skeleton className="mt-2 h-8 w-28" />
                  <div className="mt-2 flex items-center gap-1.5">
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))
            : cards.map((card) => (
                <StatCard key={card.label} {...card} />
              ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <ChartCard buckets={summary?.buckets ?? []} total={summary ? formatNumberPlain(summary.bucketTotal) : "0"} period={period} loading={loading && !summary} />
          <ActivityCard items={data?.feed ?? []} loading={loading && !data} />
        </div>
      </main>

      <KaggoAnalyticsSection
        period={period}
        buckets={summary?.buckets ?? []}
        technicians={data?.technicians ?? []}
        problems={data?.problems ?? []}
        branches={data?.branches ?? []}
        activityTerrain={data?.activityTerrain}
        branchTrend={data?.summary?.branchTrend}
        technicianRace={data?.summary?.technicianRace}
        loading={loading && !data}
      />

      <DialogPrimitive.Root open={openServis} onOpenChange={setOpenServis}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[95vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-background shadow-xl">
            <div className="overflow-y-auto scrollbar-none p-6">
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
    <div className="flex w-full flex-wrap items-center gap-2 max-sm:col-span-2 sm:w-auto">
      <Tabs value={period} onValueChange={(value) => setPeriod(value as DashboardPeriod)}>
        <TabsList className="w-full sm:w-auto">
          {DASHBOARD_PERIODS.map((option) => (
            <TabsTrigger key={option} value={option} className="px-2.5 text-xs capitalize">
              {option}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/40 px-2 py-1.5 font-mono text-xs text-muted-foreground">
        <StoreIcon className="size-3 opacity-70" />
        <span className="max-w-[140px] truncate">{branchLabel}</span>
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
  sparkline,
}: {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "neutral";
  sub: string;
  sparkline?: number[];
}) {
  const Up = trend === "up";
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">{label}</div>
        <button type="button" className="text-muted-foreground/60 transition-colors hover:text-foreground">
          <MoreHorizontalIcon className="size-4" />
        </button>
      </div>
      <div
        title={value}
        className="mt-2 min-w-0 truncate font-heading text-[clamp(1rem,5vw,1.875rem)] leading-tight tracking-tight tabular-nums"
      >
        {value}
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs">
        {trend === "neutral" ? (
          <span className="inline-flex min-w-0 items-start gap-0.5 rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] leading-snug text-muted-foreground">
            {delta}
          </span>
        ) : (
          <span
            className={`inline-flex min-w-0 items-start gap-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] leading-snug ${Up ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/12 text-rose-600 dark:text-rose-400"}`}
          >
            {Up ? <ArrowUpRightIcon className="size-3" /> : <ArrowDownRightIcon className="size-3" />}
            {delta}
          </span>
        )}
        <span className="text-muted-foreground">{sub}</span>
      </div>
      {sparkline && sparkline.length > 1 ? (
        <div className="mt-2 h-8">
          <BarSparkline data={sparkline.map((v, i) => ({ v, i }))} dataKey="v" height={32} />
        </div>
      ) : null}
    </div>
  );
}

const CHART_CONFIG = {
  masuk: { label: "Masuk", colors: { light: ["#6366f1"], dark: ["#818cf8"] } },
  diambil: { label: "Diambil", colors: { light: ["#10b981"], dark: ["#34d399"] } },
  batal: { label: "Batal", colors: { light: ["#f43f5e"], dark: ["#fb7185"] } },
} satisfies ChartConfig;

function ChartCard({
  buckets,
  total,
  period,
  loading,
}: {
  buckets: DashboardBucket[];
  total: string;
  period: DashboardPeriod;
  loading: boolean;
}) {
  const periodTitle: Record<DashboardPeriod, string> = {
    "hari ini": "Hari ini · per jam",
    "7d": "7 hari terakhir",
    "30d": "30 hari terakhir",
    "90d": "90 hari terakhir",
  };
  const [range, setRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const visible = range ? buckets.slice(range.startIndex, range.endIndex + 1) : buckets;
  const hasData = buckets.length > 0;

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-5 lg:col-span-2 lg:h-[22rem]">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Servis masuk · {period === "hari ini" ? "per jam" : period === "90d" ? "per minggu" : "harian"}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-heading text-2xl">{total}</span>
            <span className="inline-flex min-w-0 items-start gap-0.5 rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] leading-snug text-muted-foreground">
              {periodTitle[period]}
            </span>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="mt-6 h-44 w-full">
          <ChartSkeleton shape="naik" />
        </div>
      ) : !hasData ? (
        <div className="mt-6 flex h-44 items-center justify-center text-sm text-muted-foreground">Belum ada servis masuk</div>
      ) : (
        <>
          <ChartContainer config={CHART_CONFIG} className="mt-4 h-40 w-full min-w-0">
            <AreaChart data={visible} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dashboard-area-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor(0)} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={chartColor(0)} stopOpacity={0} />
                </linearGradient>
              </defs>
              <ChartGrid />
              <ChartAxis dataKey="key" interval="preserveStartEnd" tick={{ fontSize: 10 }} />
              <ChartAxis axis="y" width={32} allowDecimals={false} tick={{ fontSize: 10 }} />
              <ChartTooltip />
              <Area
                type="monotone"
                dataKey="masuk"
                name="Masuk"
                stroke={chartColor(0)}
                strokeWidth={2}
                fill="url(#dashboard-area-grad)"
              />
            </AreaChart>
          </ChartContainer>
          {/* Brush di chart pendek ini yang menentukan rentang chart area di atas. */}
          <EvilComposedChart
            className="mt-2 h-16 w-full"
            xDataKey="key"
            data={buckets}
            config={CHART_CONFIG}
            chartProps={{ margin: { top: 0, right: 8, left: 0, bottom: 0 } }}
          >
            <EvilComposedChart.XAxis dataKey="key" hide />
            <EvilComposedChart.YAxis hide />
            <EvilComposedChart.Bar dataKey="masuk" radius={2} />
            <EvilComposedChart.Brush height={22} onChange={(next) => setRange(next)} />
          </EvilComposedChart>
        </>
      )}
    </div>
  );
}
