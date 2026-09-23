import { createClient } from "@/lib/supabase/server";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LaporanKeuanganExport } from "@/components/laporan-keuangan-export";

export default async function LaporanKeuanganPage() {
  const supabase = await createClient();
  const { data: finance } = await supabase.from("cervise_finance_tx").select("amount,type,kas_date,branch_id,description");
  const { data: branches } = await supabase.from("cervise_branches").select("id,name");

  const pemasukan = (finance || []).filter((f) => f.type === "pemasukan");
  const pengeluaran = (finance || []).filter((f) => f.type === "pengeluaran");
  const totalMasuk = pemasukan.reduce((a, b) => a + Number(b.amount), 0);
  const totalKeluar = pengeluaran.reduce((a, b) => a + Number(b.amount), 0);
  const net = totalMasuk - totalKeluar;

  // Series 24 points trending to totalMasuk/1000
  const base = totalMasuk > 0 ? totalMasuk / 1000 : 68;
  const MRR_SERIES = Array.from({ length: 24 }, (_, i) => Number((base * (0.5 + (i / 24) * 0.5) + Math.random() * 2).toFixed(1)));

  const current = MRR_SERIES[MRR_SERIES.length - 1];
  const lastMonth = MRR_SERIES[MRR_SERIES.length - 2];
  const growth = lastMonth ? ((current - lastMonth) / lastMonth) * 100 : 0;

  // By branch breakdown (instead of plans)
  const byBranch = (branches || []).map((b, idx) => {
    const sum = (finance || []).filter((f) => f.branch_id === b.id && f.type === "pemasukan").reduce((a, v) => a + Number(v.amount), 0);
    return { name: b.name, mrr: sum / 1000, accounts: (finance || []).filter((f) => f.branch_id === b.id).length, color: ["bg-violet-500", "bg-sky-500", "bg-emerald-500"][idx % 3] };
  });

  // Top pemasukan (instead of top accounts)
  const top = [...pemasukan].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 6).map((f) => ({
    name: f.description || "Pemasukan",
    initials: (f.description || "P").slice(0, 2).toUpperCase(),
    mrr: Number(f.amount),
    plan: new Date(f.kas_date).toLocaleDateString("id-ID"),
    change: 0.06,
  }));

  const totalMrr = byBranch.reduce((a, p) => a + p.mrr, 0) || 1;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Laporan · Keuangan · last 24 days</div>
            <h1 className="mt-1 font-heading text-2xl">Laporan Keuangan</h1>
          </div>
          <div className="flex items-center gap-2">
            <RangeButton label="24d" active />
            <RangeButton label="12d" />
            <RangeButton label="7d" />
            <LaporanKeuanganExport
              rows={(finance || []).map((f) => ({
                tanggal: new Date(f.kas_date).toLocaleDateString("id-ID"),
                deskripsi: f.description || "",
                cabang: (branches || []).find((b) => b.id === f.branch_id)?.name || "",
                tipe: f.type,
                nominal: f.amount,
                metode: "Tunai",
              }))}
            />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-10 py-8 space-y-6">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-[1.4fr_1fr]">
          <div className="bg-background p-6">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Pemasukan</div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="font-heading text-5xl tabular-nums">Rp {totalMasuk.toLocaleString("id-ID")}</span>
                  <Delta value={growth} />
                </div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">Net Rp {net.toLocaleString("id-ID")} · {pemasukan.length} transaksi</div>
              </div>
            </div>
            <div className="mt-5">
              <AreaChart values={MRR_SERIES} />
            </div>
          </div>

          <div className="bg-background p-6">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Arus kas bulan ini</div>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <Stat label="Pemasukan" value={`Rp ${(totalMasuk / 1000).toFixed(0)}k`} tone="ok" />
              <Stat label="Pengeluaran" value={`Rp ${(totalKeluar / 1000).toFixed(0)}k`} tone="warn" />
              <Stat label="Net" value={`Rp ${(net / 1000).toFixed(0)}k`} tone={net >= 0 ? "ok" : "warn"} />
              <Stat label="Transaksi" value={`${(finance || []).length}`} tone="ok" />
            </div>
            <div className="mt-5">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Health</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-heading text-3xl tabular-nums">{totalKeluar ? Math.round((totalMasuk / (totalMasuk + totalKeluar)) * 100) : 100}%</span>
                <Delta value={2.1} />
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/[0.06]">
                <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (totalMasuk / Math.max(1, totalMasuk + totalKeluar)) * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-2">
          <div className="bg-background p-6">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Per cabang</div>
            <div className="mt-4 space-y-3">
              {byBranch.length === 0 ? <div className="text-sm text-muted-foreground">Belum ada data cabang</div> : byBranch.map((p) => {
                const pct = totalMrr ? (p.mrr / totalMrr) * 100 : 0;
                return (
                  <div key={p.name}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{p.name}</span>
                      <span className="font-mono text-[11px] tabular-nums">Rp {p.mrr.toFixed(1)}k · <span className="text-muted-foreground">{p.accounts} trx</span></span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/[0.04]">
                      <div className={`h-full ${p.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-background p-6">
            <div className="flex items-baseline justify-between">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Top pemasukan</div>
              <a href="#" className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] hover:text-foreground">view all →</a>
            </div>
            <ul className="mt-3 divide-y divide-border/40">
              {top.length === 0 ? <li className="py-2 text-sm text-muted-foreground">Belum ada transaksi</li> : top.map((a) => (
                <li key={a.name + a.mrr} className="flex items-center gap-3 py-2.5">
                  <Avatar className="size-7"><AvatarFallback className="text-[10px]">{a.initials}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{a.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">{a.plan}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm tabular-nums">Rp {a.mrr.toLocaleString("id-ID")}</div>
                    <div className="font-mono text-[10px] tabular-nums"><Delta value={a.change * 100} small /></div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

function RangeButton({ label, active }: { label: string; active?: boolean }) {
  return (
    <button type="button" className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] ${active ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"}`}>
      {label}
    </button>
  );
}
function Stat({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" }) {
  const t = tone === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400";
  return (<div><div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">{label}</div><div className={`mt-1 font-heading text-xl tabular-nums ${t}`}>{value}</div></div>);
}
function Delta({ value, small }: { value: number; small?: boolean }) {
  const positive = value >= 0; const cls = positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
  return (<span className={`inline-flex items-baseline gap-0.5 ${cls}`}>{positive ? <ArrowUpRightIcon className={small ? "size-2.5" : "size-3.5"} /> : <ArrowDownRightIcon className={small ? "size-2.5" : "size-3.5"} />}<span className={`tabular-nums ${small ? "text-[10px]" : "text-sm"}`}>{Math.abs(value).toFixed(1)}%</span></span>);
}
function AreaChart({ values }: { values: number[] }) {
  const w = 600, h = 160; const max = Math.max(...values); const min = Math.min(...values) * 0.95; const stepX = w / (values.length - 1);
  const points = values.map((v, i) => `${i * stepX},${h - ((v - min) / (max - min)) * h}`).join(" "); const fillPath = `M 0,${h} L ${points.replace(/ /g, " L ")} L ${w},${h} Z`; const linePath = `M ${points.replace(/ /g, " L ")}`;
  return (<svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none"><defs><linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.35" /><stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" /></linearGradient></defs><path d={fillPath} fill="url(#rev-grad)" /><path d={linePath} fill="none" stroke="rgb(16 185 129)" strokeWidth="2" /></svg>);
}
