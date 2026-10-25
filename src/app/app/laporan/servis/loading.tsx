import { DataTableCardSkeleton, RouteHeaderSkeleton } from "@/components/ui/route-skeleton";

/**
 * Kerangka route Laporan Harian/Bulanan.
 *
 * Dua kartu tabel dengan header kolom yang sama persis dengan tabel yang akan
 * dirender, jadi tidak ada lompatan tinggi saat data arrive.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8 space-y-8">
      <RouteHeaderSkeleton
        titleWidth="10rem"
        descriptionWidth="22rem"
        action={false}
      />

      <DataTableCardSkeleton
        title="Laporan Harian"
        description="Per hari (kas_date) — klik download di baris tanggal"
        heads={[
          "Tanggal",
          "Cabang",
          "Teknisi",
          "Total Servis",
          "Selesai",
          "Batal",
          "Pending",
          "Net (Rp)",
          "",
        ]}
        cells={["text", "text", "text", "money", "money", "money", "money", "money", "icon"]}
        rows={5}
      />

      <DataTableCardSkeleton
        title="Laporan Bulanan"
        description="Per bulan — klik download di baris bulan"
        heads={[
          "Tanggal",
          "Cabang",
          "Teknisi",
          "Total Servis",
          "Selesai",
          "Batal",
          "Pending",
          "Net (Rp)",
          "",
        ]}
        cells={["text", "text", "text", "money", "money", "money", "money", "money", "icon"]}
        rows={5}
      />
    </div>
  );
}
