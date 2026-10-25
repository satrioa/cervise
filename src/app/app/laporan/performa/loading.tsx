import { DataTableCardSkeleton, RouteHeaderSkeleton, StatCardsSkeleton } from "@/components/ui/route-skeleton";

/**
 * Kerangka route Laporan Performa.
 *
 * Empat kartu ringkasan (Teknisi, Servis selesai, Pendapatan, Total insentif)
 * lalu tabel teknisi.
 */
export default function Loading() {
  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <RouteHeaderSkeleton
          titleWidth="10rem"
          descriptionWidth="20rem"
          action={false}
        />

        <StatCardsSkeleton count={4} />

        <div className="mt-4 rounded-xl border bg-card shadow-xs/5 overflow-hidden">
          <DataTableCardSkeleton
            title="Performa teknisi"
            description="Rekap servis, pendapatan, dan insentif per teknisi"
            heads={["Teknisi", "Cabang", "Selesai", "Pendapatan", "Insentif", ""]}
            cells={["text", "text", "badge", "money", "badge", "icon"]}
            rows={5}
          />
        </div>
      </div>
    </div>
  );
}
