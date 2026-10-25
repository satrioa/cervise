import { DataTableCardSkeleton, RouteHeaderSkeleton, StatCardsSkeleton } from "@/components/ui/route-skeleton";

/**
 * Kerangka route Laporan Penjualan.
 *
 * Lima kartu ringkasan (Omzet, Retur, Sudah dibayar, Belum dibayar,
 * Transaksi) lalu dua kartu tabel harian dan bulanan.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8 space-y-8">
      <RouteHeaderSkeleton
        titleWidth="12rem"
        descriptionWidth="20rem"
        action={false}
      />

      <StatCardsSkeleton count={5} columns="lg:grid-cols-5" />

      <DataTableCardSkeleton
        title="Laporan Harian"
        description="Per hari (kas_date)"
        heads={["Tanggal", "Transaksi", "Omzet", "Belum dibayar", ""]}
        cells={["text", "money", "money", "money", "icon"]}
        rows={5}
      />

      <DataTableCardSkeleton
        title="Laporan Bulanan"
        description="Per bulan"
        heads={["Bulan", "Transaksi", "Omzet", "Belum dibayar", ""]}
        cells={["text", "money", "money", "money", "icon"]}
        rows={5}
      />
    </div>
  );
}
