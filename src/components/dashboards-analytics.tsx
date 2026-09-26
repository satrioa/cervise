import { MoreHorizontalIcon, StoreIcon, WrenchIcon, UsersIcon } from "lucide-react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Line, LineChart } from "recharts";
import { ChartAxis, ChartContainer, ChartGrid, ChartTooltip, chartColor } from "@/components/chart";
import type {
  DashboardBranch,
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

export type CerviseAnalyticsSectionProps = {
  period: DashboardPeriod;
  buckets: DashboardBucket[];
  technicians: DashboardTechnician[];
  problems: DashboardProblem[];
  branches: DashboardBranch[];
  loading?: boolean;
};

export function CerviseAnalyticsSection({
  period,
  buckets,
  technicians,
  problems,
  branches,
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
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8">
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

        <ChartContainer className="mt-4 h-72 w-full min-w-0">
          {loading ? (
            <div className="h-full w-full animate-pulse rounded-lg bg-foreground/[0.04]" />
          ) : data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Belum ada data</div>
          ) : (
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <ChartGrid />
              <ChartAxis dataKey="day" interval={period === "30d" ? 4 : period === "90d" ? 2 : 1} tick={{ fontSize: 10 }} />
              <ChartAxis axis="y" width={36} tick={{ fontSize: 10 }} />
              <ChartTooltip />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          )}
        </ChartContainer>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <BreakdownCard title="Top teknisi">
          {loading ? (
            <Empty>Memuat…</Empty>
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
            <Empty>Memuat…</Empty>
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

      <BreakdownCard title="Performa cabang" className="mt-3">
        {loading ? (
          <Empty>Memuat…</Empty>
        ) : branches.length === 0 ? (
          <Empty>Belum ada pemasukan pada periode ini</Empty>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {(() => {
              const max = Math.max(...branches.map((branch) => branch.pendapatan), 1);
              return branches.slice(0, 5).map((branch) => (
                <li
                  key={branch.id}
                  className="flex items-center gap-2.5 rounded-md border border-border/40 bg-background/40 px-3 py-2.5 text-sm"
                >
                  <Avatar className={`size-8 shrink-0 ${toneFor(branch.name)}`}>
                    <AvatarFallback className="bg-transparent text-[10px] font-medium">{initialsOf(branch.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{branch.name}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
                        <div className="h-full bg-foreground/70" style={{ width: `${Math.round((branch.pendapatan / max) * 100)}%` }} />
                      </div>
                      <span className="font-mono text-[10px] font-medium tabular-nums">{formatCurrencyPlain(branch.pendapatan)}</span>
                    </div>
                  </div>
                </li>
              ));
            })()}
          </ul>
        )}
      </BreakdownCard>
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
