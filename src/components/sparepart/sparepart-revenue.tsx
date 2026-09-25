"use client";

import { useMemo, useState } from "react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CalendarIcon,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface SparepartCategoryStat {
  name: string;
  revenueJt: number;
  sold: number;
  color: string;
}

export interface TopSparepart {
  name: string;
  revenue: number;
  category: string;
  change: number;
}

export interface SparepartMonthStats {
  sold: string;
  margin: string;
  retur: string;
  keluarServis: string;
  grossMarginPct: number;
  marginDelta: number;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  value: number; // jt Rp
}

interface Props {
  dailyJt?: DailyPoint[];
  totalUnits?: number;
  stats?: SparepartMonthStats;
  byCategory?: SparepartCategoryStat[];
  topItems?: TopSparepart[];
}

// Deterministic PRNG so SSR and client render identical mocks
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 365 hari terakhir, berakhir hari ini. Rata-rata ~0,45 jt/hari (≈13 jt/bulan).
function buildDefaultDaily(): DailyPoint[] {
  const rand = mulberry32(42);
  const today = new Date();
  const out: DailyPoint[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6 ? 1.35 : 1;
    const trend = 1 + ((364 - i) / 364) * 0.35;
    const noise = 0.75 + rand() * 0.5;
    out.push({ date: toISODate(d), value: 0.42 * weekend * trend * noise });
  }
  return out;
}

// Kurva intraday 24 jam dari total harian (toko ramai 09:00–21:00)
function hourlyFromDaily(total: number): number[] {
  const rand = mulberry32(7);
  const weights = Array.from({ length: 24 }, (_, h) => {
    if (h < 7 || h >= 22) return 0.008;
    if (h < 9) return 0.02;
    if (h < 12) return 0.06;
    if (h < 15) return 0.075;
    if (h < 18) return 0.07;
    if (h < 21) return 0.085;
    return 0.05;
  });
  const sum = weights.reduce((a, w) => a + w, 0);
  return weights.map((w) => (total * w) / sum * (0.9 + rand() * 0.2));
}

const DEFAULT_STATS: SparepartMonthStats = {
  sold: "Rp 15,1 jt",
  margin: "Rp 5,2 jt",
  retur: "Rp 0,4 jt",
  keluarServis: "38 unit",
  grossMarginPct: 34,
  marginDelta: 1.8,
};

const DEFAULT_BY_CATEGORY: SparepartCategoryStat[] = [
  { name: "LCD", revenueJt: 68.4, sold: 152, color: "bg-violet-500" },
  { name: "Baterai", revenueJt: 41.2, sold: 229, color: "bg-sky-500" },
  { name: "Flex / Kabel", revenueJt: 18.6, sold: 248, color: "bg-emerald-500" },
  { name: "Kaca / Lens", revenueJt: 9.8, sold: 103, color: "bg-amber-500" },
];

const DEFAULT_TOP: TopSparepart[] = [
  { name: "LCD iPhone 11", revenue: 5400000, category: "LCD", change: 0.06 },
  { name: "Baterai Samsung A54", revenue: 3960000, category: "Baterai", change: 0.12 },
  { name: "LCD Samsung A54", revenue: 3200000, category: "LCD", change: 0.04 },
  { name: "Flexi Cable Oppo", revenue: 1875000, category: "Flex / Kabel", change: 0.21 },
  { name: "Kaca Kamera Vivo", revenue: 1615000, category: "Kaca / Lens", change: -0.03 },
  { name: "Baterai Vivo Y20", revenue: 1440000, category: "Baterai", change: 0.08 },
];

type RangeKey = "today" | "7d" | "30d" | "12m" | "custom";

const RANGES: { label: string; key: RangeKey }[] = [
  { label: "Hari ini", key: "today" },
  { label: "7 Hari", key: "7d" },
  { label: "1 Bulan", key: "30d" },
  { label: "1 Tahun", key: "12m" },
  { label: "Kustom", key: "custom" },
];

const RANGE_CAPTION: Record<RangeKey, string> = {
  today: "Hari ini",
  "7d": "7 hari terakhir",
  "30d": "30 hari terakhir",
  "12m": "12 bulan terakhir",
  custom: "Periode kustom",
};

const rp = (n: number) => `${formatCurrencyPlain(n)}`;

function formatJt(v: number) {
  if (v >= 100) return `Rp ${v.toFixed(0)} jt`;
  if (v >= 1) return `Rp ${v.toFixed(1).replace(".", ",")} jt`;
  return `Rp ${Math.round(v * 1000)} rb`;
}

function aggregateWeekly(points: DailyPoint[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 7) {
    out.push(points.slice(i, i + 7).reduce((a, p) => a + p.value, 0));
  }
  return out;
}

function aggregateMonthly(points: DailyPoint[]): number[] {
  const buckets = new Map<string, number>();
  for (const p of points) {
    const k = p.date.slice(0, 7);
    buckets.set(k, (buckets.get(k) ?? 0) + p.value);
  }
  return [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v);
}

export function SparepartRevenue({
  dailyJt,
  totalUnits = 732,
  stats = DEFAULT_STATS,
  byCategory = DEFAULT_BY_CATEGORY,
  topItems = DEFAULT_TOP,
}: Props) {
  const base = useMemo(() => dailyJt ?? buildDefaultDaily(), [dailyJt]);
  const [range, setRange] = useState<RangeKey>("30d");
  const [customStart, setCustomStart] = useState(() => base[Math.max(0, base.length - 30)]?.date ?? "");
  const [customEnd, setCustomEnd] = useState(() => base[base.length - 1]?.date ?? "");
  const minDate = base[0]?.date ?? "";
  const maxDate = base[base.length - 1]?.date ?? "";

  const { values, totalJt, caption } = useMemo(() => {
    if (range === "today") {
      const todayTotal = base[base.length - 1]?.value ?? 0;
      return { values: hourlyFromDaily(todayTotal), totalJt: todayTotal, caption: RANGE_CAPTION.today };
    }
    if (range === "7d") {
      const pts = base.slice(-7);
      return { values: pts.map((p) => p.value), totalJt: pts.reduce((a, p) => a + p.value, 0), caption: RANGE_CAPTION["7d"] };
    }
    if (range === "12m") {
      const pts = base.slice(-365);
      const monthly = aggregateMonthly(pts);
      return { values: monthly, totalJt: pts.reduce((a, p) => a + p.value, 0), caption: RANGE_CAPTION["12m"] };
    }
    if (range === "custom") {
      const pts = base.filter((p) => p.date >= customStart && p.date <= customEnd);
      const vals = pts.length > 120 ? aggregateWeekly(pts) : pts.map((p) => p.value);
      return { values: vals, totalJt: pts.reduce((a, p) => a + p.value, 0), caption: RANGE_CAPTION.custom };
    }
    const pts = base.slice(-30);
    return { values: pts.map((p) => p.value), totalJt: pts.reduce((a, p) => a + p.value, 0), caption: RANGE_CAPTION["30d"] };
  }, [range, base, customStart, customEnd]);

  const current = values[values.length - 1] ?? 0;
  const prev = values.length > 1 ? values[values.length - 2] : current;
  const growth = prev !== 0 ? ((current - prev) / prev) * 100 : 0;
  const yearTotalJt = base.reduce((a, p) => a + p.value, 0);
  const periodUnits = yearTotalJt > 0 ? Math.round((totalJt / yearTotalJt) * totalUnits) : 0;
  const totalCat = byCategory.reduce((a, c) => a + c.revenueJt, 0);

  const [customOpen, setCustomOpen] = useState(false);
  const customLabel =
    customStart && customEnd
      ? `${format(new Date(customStart), "d MMM yyyy", { locale: localeId })} – ${format(new Date(customEnd), "d MMM yyyy", { locale: localeId })}`
      : "Pilih tanggal";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-heading text-2xl">Pendapatan Sparepart</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <TabsList>
              {RANGES.map((r) => (
                <TabsTrigger key={r.key} value={r.key}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {range === "custom" && (
            <Popover open={customOpen} onOpenChange={setCustomOpen}>
              <PopoverTrigger
                render={
                  <Button variant="outline" size="sm" className="gap-2 font-normal">
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    {customLabel}
                  </Button>
                }
              />
              <PopoverContent align="end" className="w-80 p-3">
                <div className="flex flex-col gap-3">
                  <div className="grid gap-1.5">
                    <label htmlFor="sprev-start" className="text-xs font-medium text-muted-foreground">
                      Tanggal mulai
                    </label>
                    <Input
                      id="sprev-start"
                      type="date"
                      value={customStart}
                      min={minDate}
                      max={customEnd || maxDate}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="sprev-end" className="text-xs font-medium text-muted-foreground">
                      Tanggal selesai
                    </label>
                    <Input
                      id="sprev-end"
                      type="date"
                      value={customEnd}
                      min={customStart || minDate}
                      max={maxDate}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCustomStart(base[Math.max(0, base.length - 30)]?.date ?? minDate);
                        setCustomEnd(maxDate);
                      }}
                    >
                      Reset 30 hari
                    </Button>
                    <Button size="sm" onClick={() => setCustomOpen(false)}>
                      Terapkan
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-[1.4fr_1fr]">
        <div className="bg-background p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
                {caption}
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <span className="font-heading text-5xl tabular-nums">
                  {formatJt(current)}
                </span>
                <Delta value={growth} />
              </div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                {formatJt(totalJt)} total periode · {formatNumberPlain(periodUnits)} unit terjual
              </div>
            </div>
          </div>
          <div className="mt-5">
            <AreaChart values={values} />
          </div>
        </div>

        <div className="bg-background p-6">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
            {caption}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <Stat label="Terjual" value={stats.sold} tone="ok" />
            <Stat label="Margin" value={stats.margin} tone="ok" />
            <Stat label="Retur" value={stats.retur} tone="warn" />
            <Stat label="Keluar servis" value={stats.keluarServis} tone="warn" />
          </div>
          <div className="mt-5">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
              Margin kotor
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-heading text-3xl tabular-nums">{stats.grossMarginPct}%</span>
              <Delta value={stats.marginDelta} />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/[0.06]">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${stats.grossMarginPct}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground tabular-nums">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-2">
        <div className="bg-background p-6">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
            Per kategori
          </div>
          <div className="mt-4 space-y-3">
            {byCategory.map((c) => {
              const pct = totalCat > 0 ? (c.revenueJt / totalCat) * 100 : 0;
              return (
                <div key={c.name}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{c.name}</span>
                    <span className="font-mono text-[11px] tabular-nums">
                      Rp {c.revenueJt.toFixed(1).replace(".", ",")} jt ·{" "}
                      <span className="text-muted-foreground">
                        {formatNumberPlain(c.sold)} terjual
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/[0.04]">
                    <div
                      className={`h-full ${c.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-background p-6">
          <div className="flex items-baseline justify-between">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
              Top sparepart
            </div>
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
              bulan ini
            </span>
          </div>
          <ul className="mt-3 divide-y divide-border/40">
            {topItems.map((a) => (
              <li key={a.name} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{a.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                    {a.category}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm tabular-nums">
                    {rp(a.revenue)}
                  </div>
                  <div className="font-mono text-[10px] tabular-nums">
                    <Delta value={a.change * 100} small />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn";
}) {
  const t =
    tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-amber-600 dark:text-amber-400";
  return (
    <div>
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
        {label}
      </div>
      <div className={`mt-1 font-heading text-xl tabular-nums ${t}`}>
        {value}
      </div>
    </div>
  );
}

function Delta({ value, small }: { value: number; small?: boolean }) {
  const positive = value >= 0;
  const cls = positive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";
  return (
    <span className={`inline-flex items-baseline gap-0.5 ${cls}`}>
      {positive ? (
        <ArrowUpRightIcon className={small ? "size-2.5" : "size-3.5"} />
      ) : (
        <ArrowDownRightIcon className={small ? "size-2.5" : "size-3.5"} />
      )}
      <span className={`tabular-nums ${small ? "text-[10px]" : "text-sm"}`}>
        {Math.abs(value).toFixed(1).replace(".", ",")}%
      </span>
    </span>
  );
}

function AreaChart({ values }: { values: number[] }) {
  const w = 600;
  const h = 160;
  if (values.length < 2) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none">
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="rgb(16 185 129)" strokeWidth="2" />
      </svg>
    );
  }
  const max = Math.max(...values);
  const min = Math.min(...values) * 0.95;
  const span = max - min || 1;
  const stepX = w / (values.length - 1);
  const points = values
    .map((v, i) => `${i * stepX},${h - ((v - min) / span) * h}`)
    .join(" ");
  const fillPath = `M 0,${h} L ${points.replace(/ /g, " L ")} L ${w},${h} Z`;
  const linePath = `M ${points.replace(/ /g, " L ")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sp-rev-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#sp-rev-grad)" />
      <path d={linePath} fill="none" stroke="rgb(16 185 129)" strokeWidth="2" />
    </svg>
  );
}
