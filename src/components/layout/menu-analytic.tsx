"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { getDashboardData, type DashboardData } from "@/app/app/actions";
import { playCue } from "@/lib/sound";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Isi section "Analytic Servis": tiga counter, sparkline 30 hari, dan tautan
 * ke halaman analitik lengkap.
 *
 * Datanya dari `getDashboardData("30d")` — server action yang sama dengan
 * halaman `/app/analitik-servis`, jadi angka di drawer dan di halaman tidak
 * bisa berbeda sumber. Ambang `SERVICE_ROW_CAP` di action itu yang membatasi
 * volume data, bukan komponen ini.
 */
type Totals = { masuk: number; diambil: number; batal: number };

const EMPTY_TOTALS: Totals = { masuk: 0, diambil: 0, batal: 0 };

export function MenuAnalytic({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("nav.menu");
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDashboardData("30d")
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const buckets = data?.summary.buckets ?? [];
  const totals = buckets.reduce<Totals>(
    (accumulator, bucket) => ({
      masuk: accumulator.masuk + bucket.masuk,
      diambil: accumulator.diambil + bucket.diambil,
      batal: accumulator.batal + bucket.batal,
    }),
    EMPTY_TOTALS,
  );
  const series = buckets.map((bucket) => bucket.masuk);
  const loading = !data && !failed;

  return (
    <>
      <div className="flex divide-x divide-black/10 overflow-hidden rounded-full border border-black/10 bg-white text-[11px] dark:divide-white/10 dark:border-white/10 dark:bg-neutral-800">
        <Counter label={t("masuk")} value={totals.masuk} loading={loading} />
        <Counter label={t("diambil")} value={totals.diambil} loading={loading} />
        <Counter label={t("batal")} value={totals.batal} loading={loading} />
      </div>

      <div className="mt-2.5 rounded-[18px] border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-neutral-800">
        <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-neutral-500 dark:text-neutral-400">
          {t("last30Days")}
        </p>
        <div className="mt-1.5 h-16 w-full text-[#2F80ED]">
          {loading ? (
            <Skeleton className="h-full w-full rounded-md" rows={6} />
          ) : series.length > 1 ? (
            <Sparkline data={series} />
          ) : (
            <p className="flex h-full items-center justify-center text-[11px] text-neutral-400">
              {failed ? t("loadFailed") : t("noService")}
            </p>
          )}
        </div>
      </div>

      <Link
        href="/app/analitik-servis"
        onClick={() => {
          playCue("tap");
          onNavigate?.();
        }}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-900 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-white dark:bg-neutral-800 dark:text-neutral-100 dark:ring-white/10"
      >
        {t("detail")}
        <ArrowUpRight className="size-3.5" />
      </Link>
    </>
  );
}

function Counter({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <span className="flex flex-1 items-center justify-center gap-1.5 py-1.5">
      <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
      {loading ? (
        <Skeleton as="span" className="h-2.5 w-4 rounded-sm" rows={2} />
      ) : (
        <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{value}</span>
      )}
    </span>
  );
}

/**
 * Sparkline SVG inline, versi kecil dari grafik di `dashboard-owner-client`.
 *
 * `useId` dipakai sebagai nama gradient: dua instance dengan `id` yang sama
 * membuat `url(#...)` mengambil definisi pertama yang ditemukan, dan itu bisa
 * milik kartu lain begitu halaman ini juga menampilkan grafik dashboard.
 */
function Sparkline({ data }: { data: number[] }) {
  const gradientId = `menu-spark-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const width = 240;
  const height = 64;
  const padding = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / (data.length - 1);
  const pointAt = (value: number, index: number) => {
    const x = padding + index * stepX;
    const y = padding + (1 - (value - min) / range) * (height - padding * 2);
    return { x, y };
  };
  const points = data.map((value, index) => pointAt(value, index));
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `M ${padding} ${height - padding} L ${polyline.split(" ").join(" L ")} L ${width - padding} ${height - padding} Z`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <polyline
        points={polyline}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {last ? <circle cx={last.x} cy={last.y} r="2.4" fill="currentColor" /> : null}
    </svg>
  );
}
