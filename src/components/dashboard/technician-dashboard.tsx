"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarIcon,
  ListTodoIcon,
  PackageIcon,
  TargetIcon,
  TrendingUpIcon,
  WrenchIcon,
} from "lucide-react";
import { CandyShortcut, CANDY_TONES } from "./candy-shortcut";
import { Card, TaskNoteCard } from "./task-note-card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  attentionReasonLabel,
  type AttentionItem,
} from "@/lib/operational/technician-dashboard";
import { getTechnicianDashboardData } from "@/app/app/actions/technician-dashboard";

/**
 * Dashboard teknisi.
 *
 * Kerangka mengikuti referensi `dashboards/home.json`: tanggal mono, sapaan,
 * deretan shortcut, grid 3fr/2fr (To-Do | antrean), lalu tiga kartu angka.
 * `Card` dan `FactCard` di bawah adalah komponen lokal, bukan
 * `src/components/ui/card.tsx` â€” header-nya `font-mono uppercase`, bukan
 * `CardHeader` bawaan, dan itu yang membuat tampilan sesuai desain.
 */

/**
 * `tone` diambil dari posisi item (lihat map di bawah), bukan ditulis per
 * item, supaya urutan shortcut menentukan warna dan menambah atau menggeser
 * item tidak butuh warna baru.
 */
const SHORTCUTS = [
  { label: "Servis baru", href: "/app/servis/baru", icon: WrenchIcon },
  { label: "Antrean saya", href: "/app/servis", icon: ListTodoIcon },
  { label: "Input stok", href: "/app/inventori", icon: PackageIcon },
  { label: "Target saya", href: "/app/analatik-servis", icon: TargetIcon },
];

export function TechnicianDashboard({ fullName }: { fullName: string | null }) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="px-6 py-8 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-5xl">
          <DateLine />
          <h1 className="mt-1 font-heading text-3xl tracking-tight lg:text-4xl">
            {greeting()}, {fullName ?? "Teknisi"}.
          </h1>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SHORTCUTS.map((s, index) => (
              <CandyShortcut
                key={s.href}
                label={s.label}
                href={s.href}
                icon={s.icon}
                tone={CANDY_TONES[index % CANDY_TONES.length]}
              />
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-[3fr_2fr]">
            <TaskNoteCard />
            <AttentionCard />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCards />
          </div>
        </div>
      </div>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

function DateLine() {
  const label = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">{label}</div>
  );
}

// ---------------------------------------------------------------------------
// Kartu
// ---------------------------------------------------------------------------


function FactCard({
  label,
  value,
  sub,
  icon: Icon = CalendarIcon,
  action,
}: {
  label: string;
  value: string;
  sub: string;
  icon?: typeof CalendarIcon;
  action?: { label: string; href: string };
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
          {label}
        </div>
        <Icon className="size-3.5 opacity-40" />
      </div>
      <div className="mt-2 font-heading text-2xl">{value}</div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{sub}</span>
        {action ? (
          <Link href={action.href} className="shrink-0 underline underline-offset-2">
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Antrean butuh perhatian
// ---------------------------------------------------------------------------

function AttentionCard() {
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTechnicianDashboardData()
      .then((result) => {
        if (cancelled) return;
        if (result.error) toast.error(result.error);
        setItems(result.data.attention);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card
      title="Servis Butuh Perhatian"
      trailing={
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
          {loading ? "..." : `${items.length} servis`}
        </span>
      }
    >
      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Memuat antrean...</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Tidak ada servis yang butuh perhatian.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/app/servis/${item.id}`}
                className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-foreground/[0.03]"
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    item.priority === "tinggi" ? "bg-amber-500" : "bg-sky-500",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    {item.serviceNumber ?? item.device}
                    {item.serviceNumber ? ` Â· ${item.device}` : ""}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {attentionReasonLabel(item.reason)}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-[0.2em]">
                  {item.waitingLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// KPI
// ---------------------------------------------------------------------------

function KpiCards() {
  const [kpi, setKpi] = useState<{ target: number | null; selesai: number; targetPct: number | null; unset: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTechnicianDashboardData()
      .then((result) => {
        if (!cancelled) setKpi(result.data.kpi);
      })
      .catch(() => {
        if (!cancelled) setKpi(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!kpi) {
    return <FactCard label="Target" value="â€”" sub="Memuat..." icon={TargetIcon} />;
  }

  return (
    <>
      <FactCard
        label="Target"
        icon={TargetIcon}
        value={kpi.unset ? "Belum diatur" : `${kpi.selesai} / ${kpi.target}`}
        sub={
          kpi.unset
            ? "Master Admin belum menetapkan target"
            : `${kpi.targetPct}% dari target bulan ini`
        }
        action={kpi.unset ? { label: "Atur", href: "/app/analitik-servis" } : undefined}
      />
      <FactCard
        label="Selesai bulan ini"
        icon={TrendingUpIcon}
        value={String(kpi.selesai)}
        sub="Servis Selesai atau Sudah Diambil"
      />
      <FactCard
        label="Antrean"
        icon={WrenchIcon}
        value="â€”"
        sub="Buka tab Servis untuk antrean lengkap"
        action={{ label: "Buka", href: "/app/servis" }}
      />
    </>
  );
}
