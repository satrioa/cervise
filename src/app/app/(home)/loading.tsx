import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Kerangka Home `/app` (Teknisi & Frontliner).
 *
 * Bentuknya mengikuti `BENTO_GRID_CLASS`: judul sapaan, lalu grid kartu bento
 * dengan dua kartu aksi kecil, satu kartu rekap tinggi, dan satu kartu lebar.
 * Sebelumnya Home memakai fallback global `app/loading.tsx` yang menggambar
 * kartu statistik + grafik, jadi halaman melompat dua kali.
 *
 * Route ini sengaja dipisah ke grup `(home)` supaya `loading.tsx` hanya
 * berlaku untuk `/app`, bukan untuk route lain yang belum punya loading
 * sendiri.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Memuat halaman"
      className="flex h-full min-h-0 flex-col bg-canvas text-foreground"
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mx-auto flex min-h-0 w-full max-w-[1264px] flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
            <div>
              <Skeleton className="h-2.5 w-40" />
              <Skeleton className="mt-2 h-8 w-64 max-w-full sm:h-10 sm:w-96" />
            </div>
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:min-h-0 sm:flex-1 sm:grid-cols-4 sm:gap-4 sm:grid-rows-[12rem_12rem_minmax(10.5rem,1fr)]">
            {/* Dua kartu aksi: ikon lalu label. */}
            <Panel>
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="mt-auto h-3 w-20" />
            </Panel>
            <Panel>
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="mt-auto h-3 w-20" />
            </Panel>

            {/* Rekap kas / daftar servis: tinggi tiga baris di desktop. */}
            <Panel className="max-sm:col-span-2 sm:row-span-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-3 h-6 w-32" />
              <div className="mt-4 flex flex-col gap-2.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </Panel>

            <Panel>
              <Skeleton className="h-3 w-24" />
              <div className="mt-auto flex flex-col gap-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </Panel>

            <Panel>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-auto h-8 w-16" />
            </Panel>

            <Panel>
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="mt-auto h-3 w-20" />
            </Panel>

            {/* Kartu lebar dua kolom. */}
            <Panel className="max-sm:col-span-2 sm:col-span-2">
              <Skeleton className="h-3 w-32" />
              <div className="mt-3 flex flex-col gap-2.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </Panel>

            <Panel className="max-sm:col-span-2">
              <Skeleton className="h-3 w-20" />
              <div className="mt-3 flex flex-col gap-2.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}

function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-[22px] bg-white p-4 sm:p-5 dark:bg-neutral-900",
        className,
      )}
    >
      {children}
    </div>
  );
}
