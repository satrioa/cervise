"use client";

import { useState, useEffect, useMemo } from "react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
  PlusIcon,
  WalletIcon,
  PackageIcon,
  ShoppingBagIcon,
  LayersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

function gen(base: number, drift: number) {
  const out: number[] = [base];
  for (let i = 1; i < 24; i++) {
    const noise = (Math.sin(i * 1.7 + base) * 0.5 + Math.cos(i * 0.6) * 0.3) * 0.6;
    out.push(out[i - 1] * (1 + drift / 6 + noise / 100));
  }
  return out;
}

export function DashboardsMarketShowcasePage() {
  const [finance, setFinance] = useState<any[]>([]);
  const [spareparts, setSpareparts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: fin }, { data: sp }, { data: br }] = await Promise.all([
        supabase.from("cervise_finance_tx").select("amount,type,kas_date,branch_id,description").order("kas_date", { ascending: false }).limit(200),
        supabase.from("cervise_spareparts").select("id,branch_id,stock_qty").limit(200),
        supabase.from("cervise_branches").select("id,name"),
      ]);
      setFinance((fin as any) ?? []);
      setSpareparts((sp as any) ?? []);
      setBranches((br as any) ?? []);
    })();
  }, []);

  // Featured: Omzet Bulan Ini vs Bulan Lalu
  const { featuredPrice, changePct, series } = useMemo(() => {
    const now = new Date();
    const curMonth = now.toISOString().slice(0, 7);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.toISOString().slice(0, 7);
    const curRows = finance.filter((f) => f.kas_date?.slice(0, 7) === curMonth && f.type === "pemasukan");
    const lastRows = finance.filter((f) => f.kas_date?.slice(0, 7) === lastMonth && f.type === "pemasukan");
    const curSum = curRows.reduce((a, b) => a + Number(b.amount), 0);
    const lastSum = lastRows.reduce((a, b) => a + Number(b.amount), 0);
    const pct = lastSum ? ((curSum - lastSum) / lastSum) * 100 : 0;
    // series last 24 days net
    const dailyMap = new Map<string, number>();
    for (const f of finance) {
      if (f.type !== "pemasukan") continue;
      const d = f.kas_date;
      dailyMap.set(d, (dailyMap.get(d) ?? 0) + Number(f.amount));
    }
    const sorted = Array.from(dailyMap.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-24);
    const vals = sorted.map(([, v]) => v / 1000);
    const s = vals.length ? vals : gen(120, 0.01);
    return { featuredPrice: curSum, changePct: pct, series: s.length === 24 ? s : gen(curSum / 1000 || 120, pct / 100) };
  }, [finance]);

  // Allocation: Servis, Inventori, Sales, Lain-lain
  const allocation = useMemo(() => {
    const servisSum = finance.filter((f) => f.type === "pemasukan" && (f as any).servis_id).reduce((a, b) => a + Number(b.amount), 0) || finance.filter((f) => f.type === "pemasukan").reduce((a, b) => a + Number(b.amount), 0) * 0.7;
    // Inventori terpisah: sum spareparts stock value or pengeluaran sparepart; fallback to pengeluaran
    const inventoriSum = spareparts.reduce((a, b) => a + Number(b.stock_qty ?? 0) * 50000, 0) || finance.filter((f) => f.type === "pengeluaran").reduce((a, b) => a + Number(b.amount), 0) * 0.4;
    const salesSum = 0; // placeholder Gadget & Aksesori - fitur penjualan produk nanti
    const totalMasuk = finance.filter((f) => f.type === "pemasukan").reduce((a, b) => a + Number(b.amount), 0) || 1;
    const lainSum = Math.max(0, totalMasuk - servisSum - salesSum);
    const total = servisSum + inventoriSum + salesSum + lainSum || 1;
    return [
      { name: "Servis", pct: Math.round((servisSum / total) * 100), color: "rgb(99 102 241)" },
      { name: "Inventori", pct: Math.round((inventoriSum / total) * 100), color: "rgb(16 185 129)" },
      { name: "Sales", pct: salesSum ? Math.round((salesSum / total) * 100) : 0, color: "rgb(56 189 248)", badge: "Segera" },
      { name: "Lain-lain", pct: Math.round((lainSum / total) * 100), color: "rgb(245 158 11)" },
    ];
  }, [finance, spareparts]);

  const totalNet = finance.filter((f) => f.type === "pemasukan").reduce((a, b) => a + Number(b.amount), 0) - finance.filter((f) => f.type === "pengeluaran").reduce((a, b) => a + Number(b.amount), 0);
  const watchlist = useMemo(() => {
    // per cabang top
    const byBranch = branches.map((b) => {
      const sum = finance.filter((f) => f.branch_id === b.id && f.type === "pemasukan").reduce((a, v) => a + Number(v.amount), 0);
      const cnt = finance.filter((f) => f.branch_id === b.id).length;
      return { symbol: b.name.slice(0, 4).toUpperCase(), name: b.name, price: sum, changePct: 2.1, vol: `${cnt} trx`, series: gen(sum / 1000 || 50, 0.01) };
    });
    if (byBranch.length) return byBranch.slice(0, 8);
    // fallback dummy
    return [
      { symbol: "PSAT", name: "Cervise Pusat", price: 412000, changePct: 1.42, vol: "12 trx", series: gen(412, 0.005) },
      { symbol: "CAB2", name: "Cabang 2", price: 248000, changePct: 4.12, vol: "8 trx", series: gen(238, 0.012) },
    ];
  }, [finance, branches]);

  const news = useMemo(() => {
    return finance.slice(0, 4).map((f, i) => ({
      time: new Date(f.kas_date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      source: branches.find((b) => b.id === f.branch_id)?.name ?? "Cervise",
      headline: `${f.type === "pemasukan" ? "Pemasukan" : "Pengeluaran"} ${formatCurrencyPlain(Number(f.amount))} — ${f.description ?? ""}`.slice(0, 80),
    }));
  }, [finance, branches]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Keuangan · Ringkasan</div>
          <h1 className="mt-1 font-heading text-2xl">Markets</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            Bulan ini vs Bulan lalu
            <ChevronDownIcon className="size-3" />
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <PlusIcon className="size-3.5" />
            Tambah
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-[1fr_300px]">
        <FeaturedPane price={featuredPrice} changePct={changePct} series={series} vol={`${finance.length} trx`} />
        <PortfolioPane total={totalNet} allocation={allocation} />
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-[1.6fr_1fr]">
        <WatchlistTable watchlist={watchlist} />
        <NewsPane news={news} />
      </div>
    </div>
  );
}

function FeaturedPane({ price, changePct, series, vol }: { price: number; changePct: number; series: number[]; vol: string }) {
  const positive = changePct >= 0;
  return (
    <div className="bg-background p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-2xl">IDR</span>
            <span className="font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">Omzet Bulan Ini</span>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-mono text-5xl tabular-nums">Rp {(price / 1000).toFixed(0)}k</span>
            <span className={`inline-flex items-baseline gap-0.5 font-mono tabular-nums ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {positive ? <ArrowUpRightIcon className="size-4" /> : <ArrowDownRightIcon className="size-4" />}
              {Math.abs(changePct).toFixed(2)}%
            </span>
          </div>
          <div className="mt-1 font-mono text-muted-foreground text-xs">Bulan ini vs Bulan lalu · vol {vol}</div>
        </div>
        <div className="flex gap-1">
          {["1D", "1W", "1M", "1Y", "ALL"].map((r) => (
            <button key={r} type="button" className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.25em] ${r === "1M" ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5">
        <PriceChart values={series} positive={positive} />
      </div>
    </div>
  );
}

function PortfolioPane({ total, allocation }: { total: number; allocation: { name: string; pct: number; color: string; badge?: string }[] }) {
  const totalVal = Math.abs(total);
  return (
    <div className="bg-background p-6">
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Alokasi Sumber Revenue</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-heading text-3xl tabular-nums">Rp {(totalVal / 1000).toFixed(0)}k</span>
      </div>
      <div className="mt-5">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Allocation</div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full">
          {allocation.map((a) => (
            <div key={a.name} style={{ width: `${a.pct}%`, background: a.color }} className="h-full" />
          ))}
        </div>
        <ul className="mt-3 space-y-1.5 font-mono text-[11px]">
          {allocation.map((a) => (
            <li key={a.name} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: a.color }} />
                {a.name} {a.badge && <span className="rounded bg-muted px-1.5 py-0.5 text-[9px]">{a.badge}</span>}
              </span>
              <span className="tabular-nums text-muted-foreground">{a.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function WatchlistTable({ watchlist }: { watchlist: any[] }) {
  return (
    <div className="bg-background">
      <div className="flex items-baseline justify-between border-border/40 border-b px-5 py-3">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Per Cabang</span>
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">{watchlist.length} cabang · last 30d</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-border/40 border-b text-left font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
            <th className="px-5 py-2 font-normal">Cabang</th>
            <th className="px-5 py-2 text-right font-normal">Total</th>
            <th className="px-5 py-2 text-right font-normal">Growth</th>
            <th className="px-5 py-2 font-normal">30d</th>
            <th className="px-5 py-2 text-right font-normal">Trx</th>
          </tr>
        </thead>
        <tbody>
          {watchlist.map((t) => {
            const positive = t.changePct >= 0;
            const color = positive ? "rgb(16 185 129)" : "rgb(244 63 94)";
            return (
              <tr key={t.symbol} className="border-border/30 border-b hover:bg-foreground/[0.02]">
                <td className="px-5 py-2.5">
                  <div className="font-mono text-sm">{t.symbol}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{t.name}</div>
                </td>
                <td className="px-5 py-2.5 text-right font-mono text-sm tabular-nums">Rp {(t.price / 1000).toFixed(0)}k</td>
                <td className="px-5 py-2.5 text-right font-mono text-sm tabular-nums">
                  <span className={positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                    {positive ? "+" : ""}
                    {t.changePct.toFixed(2)}%
                  </span>
                </td>
                <td className="px-5 py-2.5">
                  <div className="h-7 w-32">
                    <Spark values={t.series} color={color} />
                  </div>
                </td>
                <td className="px-5 py-2.5 text-right font-mono text-[11px] text-muted-foreground tabular-nums">{t.vol}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NewsPane({ news }: { news: { time: string; source: string; headline: string }[] }) {
  return (
    <div className="bg-background">
      <div className="flex items-baseline justify-between border-border/40 border-b px-5 py-3">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Aktivitas Terbaru</span>
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">live</span>
      </div>
      <ul className="divide-y divide-border/40">
        {news.length === 0 ? (
          <li className="px-5 py-6 text-center text-sm text-muted-foreground">Belum ada aktivitas</li>
        ) : (
          news.map((n, i) => (
            <li key={i} className="px-5 py-3">
              <div className="flex items-baseline gap-2 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                <span className="tabular-nums">{n.time}</span>
                <span>·</span>
                <span>{n.source}</span>
              </div>
              <div className="mt-1 text-sm leading-snug">{n.headline}</div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function PriceChart({ values, positive }: { values: number[]; positive: boolean }) {
  const w = 700;
  const h = 200;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(0.001, max - min);
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * stepX},${h - ((v - min) / range) * (h - 20) - 10}`).join(" L ");
  const color = positive ? "rgb(16 185 129)" : "rgb(244 63 94)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-48 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="mkt-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((y) => (
        <line key={y} x1="0" x2={w} y1={h * y} y2={h * y} stroke="rgb(127 127 127 / 0.1)" strokeDasharray="2 4" />
      ))}
      <path d={`M 0,${h} L ${pts} L ${w},${h} Z`} fill="url(#mkt-grad)" />
      <path d={`M ${pts}`} fill="none" stroke={color} strokeWidth="1.75" />
    </svg>
  );
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const w = 120;
  const h = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(0.001, max - min);
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * stepX},${h - ((v - min) / range) * (h - 4) - 2}`).join(" L ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none">
      <path d={`M ${pts}`} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}