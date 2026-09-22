import { ArrowUpRightIcon, StoreIcon, WrenchIcon, MoreHorizontalIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Line, LineChart } from "recharts";
import { ChartAxis, ChartContainer, ChartGrid, ChartTooltip, chartColor } from "@/components/chart";

// Top Teknisi — menggantikan Top channel (Count by SUM Servis)
const TOP_TEKNISI = [
  { name: "Rudi Teknisi", initials: "RT", branch: "Cervise Pusat · 3 teknisi", count: 42, share: 38, tone: "bg-violet-500/15 text-violet-600 dark:text-violet-300" },
  { name: "Sari Teknisi", initials: "ST", branch: "Cervise Cabang 2 · 2 teknisi", count: 28, share: 25, tone: "bg-rose-500/15 text-rose-600 dark:text-rose-300" },
  { name: "Eko Teknisi", initials: "ET", branch: "Cervise Pusat", count: 21, share: 19, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { name: "Andi Teknisi", initials: "AT", branch: "Cervise Cabang 3", count: 14, share: 13, tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300" },
  { name: "Budi Teknisi", initials: "BT", branch: "Cervise Express", count: 6, share: 5, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
];

// Top masalah servis — menggantikan Top pages dari template
const TOP_PROBLEMS = [
  { problem: "LCD pecah / bergaris", count: 342, change: "+12%", icon: "📱" },
  { problem: "Baterai drop / bocor", count: 298, change: "+34%", icon: "🔋" },
  { problem: "Mati total", count: 215, change: "+8%", icon: "⚡" },
  { problem: "Konektor cas goyang", count: 178, change: "+22%", icon: "🔌" },
  { problem: "Bootloop / hang logo", count: 132, change: "-3%", icon: "🔄" },
];

// Performa cabang — menggantikan Top countries (pendapatan, bukan persentase)
const TOP_CABANG = [
  { name: "Cervise Pusat", meta: "Pusat · 3 teknisi", pendapatan: 24800000, icon: "🏬" },
  { name: "Cervise Cabang 2", meta: "Tangerang · 2 teknisi", pendapatan: 16200000, icon: "🏪" },
  { name: "Cervise Cabang 3", meta: "Bekasi · 2 teknisi", pendapatan: 9800000, icon: "🏢" },
  { name: "Cervise Express", meta: "Depok · 1 teknisi", pendapatan: 4300000, icon: "🏠" },
  { name: "Mitra Reseller", meta: "Partner · dropship", pendapatan: 3100000, icon: "🤝" },
];

type Period = "hari ini" | "7d" | "30d" | "90d";

const SERIES = [
  { key: "masuk" as const, name: "Servis Masuk", color: chartColor(0) },
  { key: "diambil" as const, name: "Diambil", color: chartColor(1) },
  { key: "batal" as const, name: "Batal", color: chartColor(2) },
] as const;

function getMultiData(period: Period) {
  if (period === "hari ini") {
    const masuk = [8, 14, 18, 22, 30, 28, 42, 38, 26, 18];
    const diambil = [2, 4, 6, 8, 12, 10, 15, 14, 10, 6];
    const batal = [0, 1, 0, 1, 2, 1, 0, 1, 0, 0];
    const labels = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
    return masuk.map((_, i) => ({ day: labels[i], masuk: masuk[i], diambil: diambil[i], batal: batal[i] }));
  }
  if (period === "7d") {
    const masuk = [22, 31, 28, 45, 38, 52, 48];
    const diambil = [8, 12, 10, 15, 14, 18, 16];
    const batal = [1, 0, 2, 1, 0, 1, 2];
    const labels = ["16 Sep", "17 Sep", "18 Sep", "19 Sep", "20 Sep", "21 Sep", "22 Sep"];
    return masuk.map((_, i) => ({ day: labels[i], masuk: masuk[i], diambil: diambil[i], batal: batal[i] }));
  }
  if (period === "90d") {
    const masuk = [18, 24, 30, 38, 42, 55, 62, 70, 78, 85, 90, 96];
    const diambil = [6, 8, 10, 12, 14, 18, 20, 24, 26, 28, 30, 32];
    const batal = [1, 2, 1, 2, 1, 3, 2, 2, 3, 2, 3, 4];
    const labels = ["24 Jun", "01 Jul", "08 Jul", "15 Jul", "22 Jul", "29 Jul", "05 Agu", "12 Agu", "19 Agu", "26 Agu", "02 Sep", "22 Sep"];
    return masuk.map((_, i) => ({ day: labels[i], masuk: masuk[i], diambil: diambil[i], batal: batal[i] }));
  }
  // 30d
  const masuk = [18, 22, 19, 28, 24, 31, 35, 30, 38, 41, 36, 44, 48, 52, 46, 54, 58, 53, 61, 67, 62, 70, 75, 80, 72, 84, 90, 86, 95, 100];
  const diambil = masuk.map((v) => Math.round(v * 0.35));
  const batal = masuk.map((v) => Math.round(v * 0.08));
  const labels = Array.from({ length: 30 }, (_, i) => `Sep ${i + 1}`);
  return masuk.map((_, i) => ({ day: labels[i], masuk: masuk[i], diambil: diambil[i], batal: batal[i] }));
}

export function DashboardsAnalyticsShowcasePage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
              Cervise · Analitik servis
            </div>
            <h1 className="mt-1 font-heading text-2xl">30 hari terakhir</h1>
          </div>
          <div className="flex items-center gap-2">
            <RangePicker />
            <Button size="sm" type="button" variant="outline">
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-10 py-8">
        <AnalyticsContent />
      </main>
    </div>
  );
}

// Embeddable section — used below dashboard (no outer page chrome)
export function CerviseAnalyticsSection({ period }: { period?: Period | string } = {}) {
  const title = period === "hari ini" ? "Hari ini" : period === "7d" ? "7 hari terakhir" : period === "90d" ? "90 hari terakhir" : "30 hari terakhir";
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-xl">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">Tren servis masuk, diambil & batal — performa teknisi & cabang.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" type="button" variant="outline" className="hidden sm:inline-flex">
              Export CSV
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <AnalyticsContent period={period} />
        </div>
      </div>
    </section>
  );
}

function AnalyticsContent({ period = "30d" }: { period?: Period | string }) {
  const data = getMultiData(period as Period);
  const last = data[data.length - 1];
  const totalMasuk = data.reduce((a, b) => a + b.masuk, 0);
  const totalDiambil = data.reduce((a, b) => a + b.diambil, 0);
  const totalBatal = data.reduce((a, b) => a + b.batal, 0);
  return (
    <>
      <section className="rounded-xl border border-border/60 bg-background/40 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
              Analitik servis
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="font-heading text-3xl">{totalMasuk.toLocaleString("id-ID")}</span>
              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/12 px-1.5 py-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                <ArrowUpRightIcon className="size-3" />
                {period === "hari ini" ? "live" : "+18%"}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">vs periode lalu</span>
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
          <span className="text-muted-foreground">Masuk: <span className="font-mono font-medium text-foreground">{totalMasuk}</span></span>
          <span className="text-muted-foreground">Diambil: <span className="font-mono font-medium text-foreground">{totalDiambil}</span></span>
          <span className="text-muted-foreground">Batal: <span className="font-mono font-medium text-foreground">{totalBatal}</span></span>
        </div>

        <ChartContainer className="mt-4 h-72 w-full min-w-0">
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
        </ChartContainer>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <BreakdownCard title="Top teknisi">
          <ul className="mt-4 flex flex-col gap-3">
            {TOP_TEKNISI.map((t) => (
              <li key={t.name} className="text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className={"size-6 shrink-0 " + t.tone}>
                    <AvatarFallback className="bg-transparent text-[10px] font-medium">{t.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="truncate font-medium">{t.name}</span>
                      <span className="truncate text-xs text-muted-foreground">· {t.branch.split("·")[0].trim()}</span>
                    </div>
                  </div>
                  <span className="font-mono text-xs shrink-0">
                    <span className="text-foreground">{t.count.toLocaleString("id-ID")}</span>
                    <span className="ml-1.5 text-muted-foreground/70">{t.share}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                  <div className="h-full bg-foreground/70" style={{ width: `${t.share}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">Count by SUM servis — teknisi dengan penanganan terbanyak periode ini.</p>
        </BreakdownCard>

        <BreakdownCard title="Top masalah servis">
          <ul className="mt-4 flex flex-col gap-1">
            {TOP_PROBLEMS.map((p) => {
              const positive = p.change.startsWith("+");
              return (
                <li
                  key={p.problem}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-foreground/[0.03]"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-sm leading-none">{p.icon}</span>
                    <span className="truncate text-[13px]">{p.problem}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-xs">{p.count.toLocaleString("id-ID")} kasus</span>
                    <span
                      className={`w-12 text-right font-mono text-[10px] ${
                        positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {p.change}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">Diurutkan dari keluhan terbanyak 30 hari terakhir. Gunakan untuk stok sparepart & SOP diagnosa.</p>
        </BreakdownCard>
      </div>

      <BreakdownCard title="Performa cabang" className="mt-3">
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {(() => {
            const max = Math.max(...TOP_CABANG.map((c) => c.pendapatan));
            return TOP_CABANG.map((c) => (
              <li
                key={c.name}
                className="flex items-center gap-2.5 rounded-md border border-border/40 bg-background/40 px-3 py-2.5 text-sm"
              >
                <span className="text-base">{c.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{c.name}</div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground/70 uppercase tracking-[0.2em]">{c.meta}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
                      <div className="h-full bg-foreground/70" style={{ width: `${Math.round((c.pendapatan / max) * 100)}%` }} />
                    </div>
                    <span className="font-mono text-[10px] font-medium tabular-nums">Rp {c.pendapatan.toLocaleString("id-ID")}</span>
                  </div>
                </div>
              </li>
            ));
          })()}
        </ul>
      </BreakdownCard>
    </>
  );
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

function RangePicker() {
  return (
    <div className="flex items-center rounded-md border border-border/70 bg-background/40 font-mono text-xs text-muted-foreground">
      <button type="button" className="px-2.5 py-1.5 transition-colors hover:text-foreground">
        7d
      </button>
      <button type="button" className="bg-foreground/[0.06] px-2.5 py-1.5 text-foreground">
        30d
      </button>
      <button type="button" className="px-2.5 py-1.5 transition-colors hover:text-foreground">
        90d
      </button>
      <span className="mx-1 h-4 w-px bg-border/60" />
      <button type="button" className="inline-flex items-center gap-1 px-2.5 py-1.5 transition-colors hover:text-foreground">
        <StoreIcon className="size-3" />
        Semua cabang
      </button>
    </div>
  );
}
