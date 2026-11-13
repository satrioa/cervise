"use client";

import { useState, useEffect } from "react";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  ReceiptTextIcon,
  StoreIcon,
  Trash2Icon,
  WrenchIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { Area, AreaChart } from "recharts";
import { BarSparkline } from "@/components/charts/sparkline";
import { Button } from "@/components/ui/button";
import { ChartSkeleton, ListRowsSkeleton } from "@/components/ui/skeleton-shapes";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartAxis, ChartContainer, ChartGrid, ChartTooltip, chartColor } from "@/components/chart";
import { EvilComposedChart } from "@/components/evilcharts/charts/recharts-composed-chart";
import type { ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import { CerviseAnalyticsSection } from "@/components/dashboards-analytics";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Tooltip } from "@base-ui/react/tooltip";
import { ServisForm } from "@/components/servis/servis-form";
import { useBranch } from "@/lib/branch-context";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { getDashboardData, type DashboardData } from "@/app/app/actions";
import {
  DASHBOARD_PERIODS,
  type DashboardBucket,
  type DashboardFeedItem,
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
          delta: `Keluar ${formatCurrencyPlain(summary.pengeluaran)}`,
          trend: summary.omzet >= summary.pengeluaran ? ("up" as const) : ("down" as const),
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
    <div className="bg-background text-foreground dark:bg-[oklch(0.2_0_0)]">
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

      <CerviseAnalyticsSection
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
            <span className="inline-flex items-center gap-0.5 rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
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

type FeedFilter = "semua" | "servis" | "transaksi" | "aktivitas";
type ActivityFilter = "semua" | "edit" | "hapus" | "tambah" | "toko";

const ACTIVITY_ACTIONS: Record<Exclude<ActivityFilter, "semua">, string[]> = {
  edit: ["edit_field"],
  hapus: ["delete"],
  tambah: ["create"],
  toko: ["session_open", "session_close"],
};

const ACTIVITY_LABEL: Record<ActivityFilter, string> = {
  semua: "Semua",
  edit: "Edit",
  hapus: "Hapus",
  tambah: "Tambah",
  toko: "Buka-tutup Toko",
};

function matchesFeedFilter(item: DashboardFeedItem, filter: FeedFilter, activity: ActivityFilter): boolean {
  if (filter === "servis") return item.kind === "service";
  if (filter === "transaksi") return item.kind === "transaction";
  if (filter === "aktivitas") {
    if (activity === "semua") {
      return item.kind === "activity" || ACTIVITY_ACTIONS.tambah.includes(item.action);
    }
    return ACTIVITY_ACTIONS[activity].includes(item.action);
  }
  return true;
}

const FEED_VISIBLE_LIMIT = 20;

function localDayKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function feedAppearance(item: DashboardFeedItem): { Icon: LucideIcon; className: string } {
  if (item.kind === "transaction") {
    return { Icon: ReceiptTextIcon, className: "bg-blue-500/12 text-blue-600 dark:text-blue-400" };
  }
  if (item.kind === "service") {
    return { Icon: WrenchIcon, className: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" };
  }
  if (item.action === "delete") {
    return { Icon: Trash2Icon, className: "bg-rose-500/12 text-rose-600 dark:text-rose-400" };
  }
  if (item.action === "edit_field") {
    return { Icon: PencilIcon, className: "bg-amber-500/12 text-amber-600 dark:text-amber-400" };
  }
  return { Icon: StoreIcon, className: "bg-violet-500/12 text-violet-600 dark:text-violet-400" };
}

function ActivityCard({ items, loading }: { items: DashboardFeedItem[]; loading: boolean }) {
  const [filter, setFilter] = useState<FeedFilter>("semua");
  const [activity, setActivity] = useState<ActivityFilter>("semua");
  const [dayOffset, setDayOffset] = useState<0 | -1>(0);

  const selectedDay = new Date();
  selectedDay.setDate(selectedDay.getDate() + dayOffset);
  const selectedDayKey = localDayKey(selectedDay);
  const filtered = items
    .filter(
      (item) =>
        matchesFeedFilter(item, filter, activity) && localDayKey(item.createdAt) === selectedDayKey,
    )
    .slice(0, FEED_VISIBLE_LIMIT);
  const dayLabel = dayOffset === 0 ? "Hari ini" : "Kemarin";

  return (
    <div className="flex flex-col rounded-xl border border-border/60 bg-background/40 p-5 lg:h-[22rem]">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Recent activity</div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setDayOffset(-1)}
            disabled={dayOffset === -1}
            aria-label="Hari sebelumnya"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeftIcon className="size-3.5" />
          </button>
          <span className="min-w-14 text-center font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {dayLabel}
          </span>
          <button
            type="button"
            onClick={() => setDayOffset(0)}
            disabled={dayOffset === 0}
            aria-label="Hari berikutnya"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRightIcon className="size-3.5" />
          </button>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as FeedFilter)} className="mt-3">
        <TabsList className="w-full">
          <TabsTrigger value="semua" className="px-1.5 text-xs">Semua</TabsTrigger>
          <TabsTrigger value="servis" className="px-1.5 text-xs">Servis</TabsTrigger>
          <TabsTrigger value="transaksi" className="px-1.5 text-xs">Transaksi</TabsTrigger>
          <TabsTrigger value="aktivitas" className="px-1.5 text-xs">Aktivitas</TabsTrigger>
        </TabsList>
      </Tabs>

      {filter === "aktivitas" ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {(Object.keys(ACTIVITY_LABEL) as ActivityFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setActivity(option)}
              className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors ${
                activity === option
                  ? "bg-foreground/[0.08] text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ACTIVITY_LABEL[option]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 max-h-[18rem] min-h-0 flex-1 overflow-y-auto pr-1 lg:max-h-none">
        {loading ? (
          <ListRowsSkeleton rows={4} leading="icon" lines={2} />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada aktivitas {dayOffset === 0 ? "hari ini" : "kemarin"}
          </p>
        ) : (
          <Tooltip.Provider>
            <ul className="flex flex-col gap-3.5">
              {filtered.map((item) => {
                const { Icon, className } = feedAppearance(item);
                return (
                  <li key={item.id}>
                    <Tooltip.Root>
                      <Tooltip.Trigger
                        render={
                          <div
                            tabIndex={0}
                            className="flex items-start gap-3 rounded-md text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        }
                      >
                        <span
                          className={`mt-1 flex size-6 shrink-0 items-center justify-center rounded-full ${className}`}
                        >
                          <Icon className="size-3.5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1 leading-snug">
                          <div className="flex items-baseline gap-1.5">
                            <span className="truncate font-medium">{item.title}</span>
                            <span className="shrink-0 rounded bg-foreground/[0.06] px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                              {item.actionLabel}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">{item.detail}</div>
                          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                            {new Date(item.createdAt).toLocaleDateString("id-ID")}
                          </div>
                        </div>
                        {item.amount !== null ? (
                          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                            {formatCurrencyPlain(item.amount)}
                          </span>
                        ) : null}
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Positioner sideOffset={8} className="z-50">
                          <Tooltip.Popup className="w-72 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-md">
                            <div className="font-medium">
                              {item.actionLabel} · {item.title}
                            </div>
                            <div className="mt-1 text-muted-foreground">{item.detail}</div>
                            <div className="mt-2 grid gap-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                              {item.serviceId ? <span>Servis {item.serviceId.slice(0, 8).toUpperCase()}</span> : null}
                              {item.device ? <span>Perangkat {item.device}</span> : null}
                              <span>Oleh {item.actor}</span>
                              <span>{new Date(item.createdAt).toLocaleString("id-ID")}</span>
                            </div>
                          </Tooltip.Popup>
                        </Tooltip.Positioner>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </li>
                );
              })}
            </ul>
          </Tooltip.Provider>
        )}
      </div>
    </div>
  );
}
