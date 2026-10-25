import { ChartSkeleton } from "@/components/ui/skeleton-shapes";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableCardSkeleton, RouteHeaderSkeleton, StatCardsSkeleton } from "@/components/ui/route-skeleton";

/**
 * Kerangka route Laporan Keuangan.
 *
 * Empat kartu total periode, blok ringkasan (angka omzet + grafik + panel
 * sumber pemasukan), tabel per cabang, lalu kartu harian dan bulanan.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8 space-y-8">
      <RouteHeaderSkeleton
        titleWidth="12rem"
        descriptionWidth="22rem"
        action={false}
      />

      <StatCardsSkeleton count={4} />

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-[1fr_320px]">
        <div className="bg-background p-6">
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="mt-3 h-10 w-56" />
          <Skeleton className="mt-3 h-3 w-64" />
          <div className="mt-5 h-24 w-full">
            <ChartSkeleton variant="sparkline" shape="naik" />
          </div>
        </div>
        <div className="bg-background p-6">
          <Skeleton className="h-2.5 w-32" />
          <div className="mt-4 flex h-40 items-center justify-center">
            <Skeleton className="size-32 rounded-full" />
          </div>
          <div className="mt-3 space-y-1.5">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center justify-between gap-2">
                <Skeleton className="h-2.5" style={{ width: `${45 + ((row * 11) % 30)}%` }} />
                <Skeleton className="h-2.5 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-[1.6fr_1fr]">
        <div className="bg-background">
          <div className="flex items-baseline justify-between border-border/40 border-b px-5 py-3">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Per Cabang</span>
            <Skeleton className="h-2.5 w-32" />
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-border/40 border-b text-left font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
                <th className="px-5 py-2 font-normal">Cabang</th>
                <th className="px-5 py-2 text-right font-normal">Masuk</th>
                <th className="px-5 py-2 text-right font-normal">Keluar</th>
                <th className="px-5 py-2 text-right font-normal">Net</th>
                <th className="px-5 py-2 text-right font-normal">Trx</th>
              </tr>
            </thead>
            <tbody>
              <TableRowsSkeletonCells />
            </tbody>
          </table>
        </div>
        <div className="bg-background">
          <div className="flex items-baseline justify-between border-border/40 border-b px-5 py-3">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Aktivitas Terbaru</span>
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">live</span>
          </div>
          <ul className="divide-y divide-border/40">
            {[0, 1, 2, 3].map((row) => (
              <li key={row} className="px-5 py-3">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="mt-2 h-3.5" style={{ width: `${55 + ((row * 13) % 30)}%` }} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <DataTableCardSkeleton
        title="Laporan Harian"
        description="Per hari (kas_date) — klik download di baris tanggal"
        heads={["Tanggal", "Cabang", "Total Trx", "Masuk", "Keluar", "Net (Rp)", ""]}
        cells={["text", "text", "money", "money", "money", "money", "icon"]}
        rows={5}
      />

      <DataTableCardSkeleton
        title="Laporan Bulanan"
        description="Per bulan — klik download di baris bulan"
        heads={["Tanggal", "Cabang", "Total Trx", "Masuk", "Keluar", "Net (Rp)", ""]}
        cells={["text", "text", "money", "money", "money", "money", "icon"]}
        rows={5}
      />
    </div>
  );
}

/** Baris tabel per cabang: 5 kolom. */
function TableRowsSkeletonCells() {
  return (
    <>
      {Array.from({ length: 3 }, (_, row) => (
        <tr key={row} className="border-border/30 border-b">
          <td className="px-5 py-2.5"><Skeleton className="h-3" style={{ width: `${45 + ((row * 13) % 35)}%` }} /></td>
          <td className="px-5 py-2.5 text-right"><Skeleton className="ml-auto h-3 w-20" /></td>
          <td className="px-5 py-2.5 text-right"><Skeleton className="ml-auto h-3 w-20" /></td>
          <td className="px-5 py-2.5 text-right"><Skeleton className="ml-auto h-3 w-20" /></td>
          <td className="px-5 py-2.5 text-right"><Skeleton className="ml-auto h-3 w-10" /></td>
        </tr>
      ))}
    </>
  );
}
