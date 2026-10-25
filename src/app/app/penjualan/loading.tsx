import { ProductCardsSkeleton } from "@/components/ui/route-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Kerangka route Penjualan (POS).
 *
 * POS punya dua kolom: panel produk di kiri dan keranjang di kanan. Panel
 * produk menampilkan kartu produk (ikon besar + nama/SKU + badge stok +
 * harga), jadi skeleton-nya memakai bentuk kartu, bukan baris tabel.
 */
export default function Loading() {
  return (
    <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-3 lg:px-6 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_380px]">
      <div className="min-w-0 rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>
        <div className="border-b px-3 py-2">
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
        <div className="bg-muted/20 p-2.5">
          <ProductCardsSkeleton count={6} />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-8 w-full rounded-lg" />
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center justify-between gap-2 border-b pb-2">
              <div className="space-y-1.5">
                <Skeleton className="h-3" style={{ width: `${45 + ((row * 13) % 30)}%` }} />
                <Skeleton className="h-2.5 w-16" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-4 h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}
