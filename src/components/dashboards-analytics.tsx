import { MoreHorizontalIcon, StoreIcon, WrenchIcon, UsersIcon } from "lucide-react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import ActivityTerrain from "@/components/kokonutui/activity-terrain";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChartSkeleton } from "@/components/ui/skeleton-shapes";
import { Skeleton } from "@/components/ui/skeleton";
import { Area, AreaChart, Line, LineChart, Tooltip } from "recharts";
import { StackedBarBandCursor } from "@/components/stacked-bar-band-cursor";
import { ChartAxis, ChartContainer, ChartGrid, ChartTooltip, chartColor } from "@/components/chart";
import type {
  DashboardActivityTerrain,
  DashboardBranch,
  DashboardBranchTrend,
  DashboardBucket,
  DashboardPeriod,
  DashboardProblem,
  DashboardTechnician,
} from "@/lib/operational/dashboard";

const SERIES = [
  { key: "masuk" as const, name: "Servis Masuk", color: chartColor(0) },
  { key: "diambil" as const, name: "Diambil", color: chartColor(1) },
  { key: "batal" as const, name: "Batal", color: chartColor(2) },
] as const;

const TONES = [
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
];

function toneFor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash + seed.charCodeAt(index)) % TONES.length;
  return TONES[hash];
}

function initialsOf(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

/** Format Rp singkat & dibulatkan untuk sumbu chart, mis. Rp1jt, Rp1,5jt. */
function formatRpShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) {
    const v = Math.round((abs / 1_000_000_000) * 10) / 10;
    return `${sign}Rp${v % 1 === 0 ? v.toFixed(0) : v.toString().replace(".", ",")}M`;
  }
  if (abs >= 1_000_000) {
    const v = Math.round((abs / 1_000_000) * 10) / 10;
    return `${sign}Rp${v % 1 === 0 ? v.toFixed(0) : v.toString().replace(".", ",")}jt`;
  }
  if (abs >= 1_000) {
    const v = Math.round((abs / 1_000) * 10) / 10;
    return `${sign}Rp${v % 1 === 0 ? v.toFixed(0) : v.toString().replace(".", ",")}rb`;
  }
  if (abs === 0) return "Rp0";
  return `${sign}Rp${Math.round(abs)}`;
}

export type CerviseAnalyticsSectionProps = {
  period: DashboardPeriod;
  buckets: DashboardBucket[];
  technicians: DashboardTechnician[];
  problems: DashboardProblem[];
  branches: DashboardBranch[];
  activityTerrain?: DashboardActivityTerrain;
  branchTrend?: DashboardBranchTrend;
  loading?: boolean;
};

export function CerviseAnalyticsSection({
  period,
  buckets,
  technicians,
  problems,
  branches,
  activityTerrain,
  branchTrend,
  loading = false,
}: CerviseAnalyticsSectionProps) {
  const title =
    period === "hari ini"
      ? "Hari ini"
      : period === "7d"
        ? "7 hari terakhir"
        : period === "90d"
          ? "90 hari terakhir"
          : "30 hari terakhir";

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-xl">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Tren servis masuk, diambil &amp; batal — performa teknisi &amp; cabang.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <AnalyticsContent
            period={period}
            buckets={buckets}
            technicians={technicians}
            problems={problems}
            branches={branches}
            activityTerrain={activityTerrain}
            branchTrend={branchTrend}
            loading={loading}
          />
        </div>
      </div>
    </section>
  );
}

function AnalyticsContent({
  period,
  buckets,
  technicians,
  problems,
  branches,
  activityTerrain,
  branchTrend,
  loading,
}: CerviseAnalyticsSectionProps) {
  const data = buckets.map((bucket) => ({
    day: bucket.key,
    masuk: bucket.masuk,
    diambil: bucket.diambil,
    batal: bucket.batal,
  }));
  const totalMasuk = data.reduce((total, row) => total + row.masuk, 0);
  const totalDiambil = data.reduce((total, row) => total + row.diambil, 0);
  const totalBatal = data.reduce((total, row) => total + row.batal, 0);
  const terrain = activityTerrain ?? { data: [], endDate: new Date().toISOString().slice(0, 10) };

  return (
    <>
      <section className="rounded-xl border border-border/60 bg-background/40 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
              Analitik servis
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="font-heading text-3xl">{formatNumberPlain(totalMasuk)}</span>
              <span className="font-mono text-[10px] text-muted-foreground">servis masuk</span>
            </div>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
            {SERIES.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm" style={{ backgroundColor: s.color }} />
                {s.name}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <span className="text-muted-foreground">Masuk: <span className="font-mono font-medium text-foreground">{formatNumberPlain(totalMasuk)}</span></span>
          <span className="text-muted-foreground">Diambil: <span className="font-mono font-medium text-foreground">{formatNumberPlain(totalDiambil)}</span></span>
          <span className="text-muted-foreground">Batal: <span className="font-mono font-medium text-foreground">{formatNumberPlain(totalBatal)}</span></span>
        </div>

        {loading ? (
          <ChartSkeleton shape={period === "90d" ? "datar" : "naik"} />
        ) : data.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Belum ada data</div>
        ) : (
          <StackedBarBandCursor buckets={buckets} />
        )}
      </section>

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <BreakdownCard title="Top teknisi">
          {loading ? (
            <ul aria-hidden className="mt-4 flex flex-col gap-3">
              {Array.from({ length: 5 }, (_, row) => (
                <li key={row} className="text-sm">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-6 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <Skeleton
                        className="h-3"
                        style={{ width: `${45 + ((row * 11) % 35)}%` }}
                      />
                    </div>
                    <Skeleton className="h-3 w-14 shrink-0" />
                  </div>
                  <Skeleton className="mt-1.5 h-1 w-full rounded-full" />
                </li>
              ))}
            </ul>
          ) : technicians.length === 0 ? (
            <Empty>Belum ada servis dengan teknisiassigned</Empty>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {technicians.slice(0, 5).map((technician) => (
                <li key={technician.id ?? technician.name} className="text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className={"size-6 shrink-0 " + toneFor(technician.name)}>
                      <AvatarFallback className="bg-transparent text-[10px] font-medium">{technician.initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="truncate font-medium">{technician.name}</span>
                      </div>
                    </div>
                    <span className="font-mono text-xs shrink-0">
                      <span className="text-foreground">{formatNumberPlain(technician.count)}</span>
                      <span className="ml-1.5 text-muted-foreground/70">{technician.share}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                    <div className="h-full bg-foreground/70" style={{ width: `${technician.share}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">Jumlah servis yang ditangani teknisi pada periode ini.</p>
        </BreakdownCard>

        <BreakdownCard title="Top masalah servis">
          {loading ? (
            <ul aria-hidden className="mt-4 flex flex-col gap-1">
              {Array.from({ length: 6 }, (_, row) => (
                <li
                  key={row}
                  className="flex items-center justify-between gap-3 px-2 py-2"
                >
                  <Skeleton
                    className="h-3"
                    style={{ width: `${42 + ((row * 9) % 32)}%` }}
                  />
                  <Skeleton className="h-3 w-16 shrink-0" />
                </li>
              ))}
            </ul>
          ) : problems.length === 0 ? (
            <Empty>Belum ada keluhan tercatat</Empty>
          ) : (
            <ul className="mt-4 flex flex-col gap-1">
              {problems.slice(0, 6).map((problem) => (
                <li
                  key={problem.problem}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-foreground/[0.03]"
                >
                  <span className="truncate text-[13px]">{problem.problem}</span>
                  <span className="shrink-0 font-mono text-xs">{formatNumberPlain(problem.count)} kasus</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Diurutkan dari keluhan terbanyak pada periode ini. Gunakan untuk stok sparepart &amp; SOP diagnosa.
          </p>
        </BreakdownCard>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
        <BreakdownCard title="Performa cabang">
          {loading ? (
            <ChartSkeleton shape={period === "90d" ? "datar" : "naik"} className="mt-4 h-56" />
          ) : !branchTrend || branchTrend.series.length === 0 ? (
            <Empty>Belum ada pemasukan pada periode ini</Empty>
          ) : (
            <ChartContainer className="mt-4 h-56 w-full min-w-0">
              <AreaChart
                data={branchTrend.buckets.map((b) => ({ day: b.key, ...b.values }))}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  {branchTrend.series.map((s, i) => (
                    <linearGradient key={s.id} id={`branch-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor(i)} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColor(i)} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <ChartGrid />
                <ChartAxis dataKey="day" interval={period === "30d" ? 4 : period === "90d" ? 2 : 1} tick={{ fontSize: 10 }} />
                <ChartAxis axis="y" width={52} tick={{ fontSize: 10 }} tickFormatter={formatRpShort} />
                <Tooltip
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="grid min-w-32 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                        <div className="font-medium">{String(label ?? "")}</div>
                        <div className="grid gap-1">
                          {payload
                            .filter((item: any) => item.type !== "none")
                            .map((item: any) => (
                              <div key={String(item.dataKey)} className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                                  {item.name ?? item.dataKey}
                                </span>
                                <span className="font-mono font-medium tabular-nums text-foreground">
                                  {formatRpShort(Number(item.value ?? 0))}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  }}
                />
                {branchTrend.series.map((s, i) => (
                  <Area
                    key={s.id}
                    type="monotone"
                    dataKey={s.id}
                    name={s.name}
                    stroke={chartColor(i)}
                    strokeWidth={2}
                    fill={`url(#branch-grad-${i})`}
                  />
                ))}
              </AreaChart>
            </ChartContainer>
          )}
        </BreakdownCard>
        <div className="flex flex-col gap-2">
          <ActivityTerrain
            data={loading ? [] : terrain.data}
            endDate={terrain.endDate}
            title="Aktivitas toko"
            className="w-full max-w-none"
          />
          <p className="px-1 text-[11px] text-muted-foreground">Servis masuk + penjualan produk (HP &amp; aksesoris)</p>
        </div>
      </div>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

function BreakdownCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border/60 bg-background/40 p-5 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] flex items-center gap-1.5">
          {(title === "Top cabang" || title === "Performa cabang") && <StoreIcon className="size-3" />}
          {title === "Top masalah servis" && <WrenchIcon className="size-3" />}
          {title === "Top teknisi" && <UsersIcon className="size-3" />}
          {title}
        </div>
        <button type="button" className="text-muted-foreground/60 transition-colors hover:text-foreground">
          <MoreHorizontalIcon className="size-4" />
        </button>
      </div>
      {children}
    </section>
  );
}
