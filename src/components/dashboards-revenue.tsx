import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  DownloadIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const MRR_SERIES = [
  68.4, 71.2, 73.0, 76.8, 78.4, 82.1, 84.6, 88.3, 91.0, 95.7, 99.2, 103.4,
  108.6, 112.0, 116.4, 121.2, 125.7, 128.9, 132.5, 134.4, 138.0, 140.1, 141.6,
  142.4,
];

const PLANS = [
  { name: "Enterprise", mrr: 78.2, accounts: 41, color: "bg-violet-500" },
  { name: "Business", mrr: 41.6, accounts: 312, color: "bg-sky-500" },
  { name: "Pro", mrr: 18.4, accounts: 1284, color: "bg-emerald-500" },
  { name: "Starter", mrr: 4.2, accounts: 4126, color: "bg-amber-500" },
];

const TOP_ACCOUNTS = [
  { name: "Linear", initials: "LN", mrr: 8400, plan: "Enterprise", change: 0.06 },
  { name: "Vercel", initials: "VC", mrr: 6200, plan: "Enterprise", change: 0.12 },
  { name: "Supabase", initials: "SB", mrr: 5800, plan: "Enterprise", change: 0.04 },
  { name: "Resend", initials: "RS", mrr: 4900, plan: "Business", change: 0.21 },
  { name: "PlanetScale", initials: "PS", mrr: 4200, plan: "Business", change: -0.03 },
  { name: "Cal.com", initials: "CL", mrr: 3800, plan: "Business", change: 0.08 },
];

export function DashboardsRevenueShowcasePage() {
  const totalMrr = PLANS.reduce((acc, p) => acc + p.mrr, 0);
  const arr = totalMrr * 12;
  const lastMonth = MRR_SERIES[MRR_SERIES.length - 2];
  const current = MRR_SERIES[MRR_SERIES.length - 1];
  const growth = ((current - lastMonth) / lastMonth) * 100;

  return (
    <div className="min-h-svh bg-background px-10 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
              Revenue · last 24 months
            </div>
            <h1 className="mt-1 font-heading text-2xl">Recurring revenue</h1>
          </div>
          <div className="flex items-center gap-2">
            <RangeButton label="24m" active />
            <RangeButton label="12m" />
            <RangeButton label="3m" />
            <Button variant="outline" size="sm" className="gap-1.5">
              <DownloadIcon className="size-3.5" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-[1.4fr_1fr]">
          <div className="bg-background p-6">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
                  MRR
                </div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="font-heading text-5xl tabular-nums">
                    ${current.toFixed(1)}k
                  </span>
                  <Delta value={growth} />
                </div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  ${arr.toFixed(0)}k ARR · 5,783 paying accounts
                </div>
              </div>
            </div>
            <div className="mt-5">
              <AreaChart values={MRR_SERIES} />
            </div>
          </div>

          <div className="bg-background p-6">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
              Net new this month
            </div>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <Stat label="New MRR" value="+$3.8k" tone="ok" />
              <Stat label="Expansion" value="+$1.4k" tone="ok" />
              <Stat label="Contraction" value="−$0.6k" tone="warn" />
              <Stat label="Churn" value="−$2.5k" tone="warn" />
            </div>
            <div className="mt-5">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
                Net revenue retention
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-heading text-3xl tabular-nums">112%</span>
                <Delta value={2.1} />
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/[0.06]">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: "112%", maxWidth: "100%" }}
                />
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground tabular-nums">
                <span>0%</span>
                <span>100%</span>
                <span>120%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-2">
          <div className="bg-background p-6">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
              By plan
            </div>
            <div className="mt-4 space-y-3">
              {PLANS.map((p) => {
                const pct = (p.mrr / totalMrr) * 100;
                return (
                  <div key={p.name}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{p.name}</span>
                      <span className="font-mono text-[11px] tabular-nums">
                        ${p.mrr.toFixed(1)}k ·{" "}
                        <span className="text-muted-foreground">
                          {p.accounts.toLocaleString()} acc
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/[0.04]">
                      <div
                        className={`h-full ${p.color}`}
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
                Top accounts
              </div>
              <a
                href="#"
                className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] hover:text-foreground"
              >
                view all →
              </a>
            </div>
            <ul className="mt-3 divide-y divide-border/40">
              {TOP_ACCOUNTS.map((a) => (
                <li
                  key={a.name}
                  className="flex items-center gap-3 py-2.5"
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px]">
                      {a.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{a.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                      {a.plan}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm tabular-nums">
                      ${a.mrr.toLocaleString()}
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
    </div>
  );
}

function RangeButton({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] ${
        active
          ? "bg-foreground/[0.06] text-foreground"
          : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
      }`}
    >
      {label}
    </button>
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
        {Math.abs(value).toFixed(1)}%
      </span>
    </span>
  );
}

function AreaChart({ values }: { values: number[] }) {
  const w = 600;
  const h = 160;
  const max = Math.max(...values);
  const min = Math.min(...values) * 0.95;
  const stepX = w / (values.length - 1);
  const points = values
    .map((v, i) => `${i * stepX},${h - ((v - min) / (max - min)) * h}`)
    .join(" ");
  const fillPath = `M 0,${h} L ${points.replace(/ /g, " L ")} L ${w},${h} Z`;
  const linePath = `M ${points.replace(/ /g, " L ")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#rev-grad)" />
      <path d={linePath} fill="none" stroke="rgb(16 185 129)" strokeWidth="2" />
    </svg>
  );
}
