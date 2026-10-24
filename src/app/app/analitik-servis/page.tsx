"use client";

import { useEffect, useState } from "react";
import { CerviseAnalyticsSection } from "@/components/dashboards-analytics";
import { getDashboardData, type DashboardData } from "@/app/app/actions";
import type { DashboardPeriod } from "@/lib/operational/dashboard";
import { PageHeader } from "@/components/layout/page-header";

const PERIODS: DashboardPeriod[] = ["hari ini", "7d", "30d", "90d"];

const PERIOD_LABEL: Record<DashboardPeriod, string> = {
  "hari ini": "Hari ini",
  "7d": "7 hari",
  "30d": "30 hari",
  "90d": "90 hari",
};

/**
 * Route analitik servis.
 *
 * `CerviseAnalyticsSection` sudah komponen terpisah dengan props lengkap, jadi
 * halaman ini tidak menyalin apa pun — dia hanya memanggil `getDashboardData()`
 * yang sama dengan dashboard utama dan meneruskannya. Dashboard `MASTER_ADMIN`
 * dan `ADMIN` tetap menampilkan section-nya di `/app` seperti sebelumnya.
 */
export default function AnalitikServisPage() {
  const [period, setPeriod] = useState<DashboardPeriod>("30d");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset during render ketika period berubah, supaya body effect hanya
  // melakukan fetch dan tidak pernah setState secara sinkron. Pola yang sama
  // dipakai `dashboard-owner-client.tsx`.
  const [loadedPeriod, setLoadedPeriod] = useState(period);
  if (loadedPeriod !== period) {
    setLoadedPeriod(period);
    setData(null);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    getDashboardData(period)
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Gagal memuat data analitik");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <div className="min-h-svh bg-transparent text-foreground">
      <PageHeader
        title="Analitik Servis"
        titleClassName="font-heading text-2xl"
        description="Tren servis masuk, diambil &amp; batal — performa teknisi &amp; cabang."
        actions={
          <div className="flex gap-1 rounded-lg border border-border/60 p-0.5">
            {PERIODS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                aria-pressed={period === value}
                className={
                  period === value
                    ? "rounded-md bg-foreground px-2.5 py-1 text-xs text-background"
                    : "rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-foreground/[0.05]"
                }
              >
                {PERIOD_LABEL[value]}
              </button>
            ))}
          </div>
        }
      />

      {error ? (
        <p className="mx-auto max-w-6xl px-6 pt-6 text-sm text-destructive">{error}</p>
      ) : null}

      <CerviseAnalyticsSection
        period={period}
        buckets={data?.summary.buckets ?? []}
        technicians={data?.technicians ?? []}
        problems={data?.problems ?? []}
        branches={data?.branches ?? []}
        loading={loading && !data}
      />
    </div>
  );
}
