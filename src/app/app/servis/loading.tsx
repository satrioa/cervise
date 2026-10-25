import { Skeleton } from "@/components/ui/skeleton";
import { RouteFiltersSkeleton, RouteHeaderSkeleton } from "@/components/ui/route-skeleton";

/**
 * Kerangka route Servis.
 *
 * Bentuknya mengikuti halaman servis: baris filter, lalu tabel servis dengan
 * kolom checkbox, Servis, Device, Status, Teknisi, Pembayaran, Harga.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
      <RouteHeaderSkeleton
        titleWidth="6rem"
        description={false}
        action
      />

      <RouteFiltersSkeleton chips={3} />

      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center gap-4 border-b bg-muted/30 px-4 py-2.5">
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="h-3 w-24 shrink-0" />
          <Skeleton className="h-3 w-28 flex-1" />
          <Skeleton className="h-3 w-20 shrink-0" />
          <Skeleton className="h-3 w-20 shrink-0" />
          <Skeleton className="h-3 w-16 shrink-0" />
          <Skeleton className="h-3 w-20 shrink-0" />
        </div>
        {Array.from({ length: 8 }, (_, row) => (
          <div key={row} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
            <Skeleton className="size-4 shrink-0 rounded" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="h-4 w-28 shrink-0" />
            <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
            <Skeleton className="h-3 w-16 shrink-0" />
            <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
