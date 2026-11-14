import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Kerangka Home `/app` (Frontliner & Teknisi).
 *
 * Mengikuti grid bento: sapaan, lalu kartu aksi/rekap. Kartu "Ringkasan Servis"
 * (gauge + Masuk/Selesai/Diambil) disertakan sebagai bentuk kartu ringkasan.
 * Skeleton ini umum untuk kedua role karena route loading tidak tahu role.
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
            {/* Aksi: Servis baru */}
            <Panel>
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="mt-auto h-3 w-24" />
            </Panel>
            {/* Aksi: Catat Kas / Sparepart */}
            <Panel>
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="mt-auto h-3 w-20" />
            </Panel>

            {/* Rekap tinggi (Ringkasan Hari ini / daftar) */}
            <Panel className="max-sm:col-span-2 sm:row-span-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="mt-3 h-7 w-36" />
              <div className="mt-4 flex flex-col gap-2.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="mt-auto pt-4 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </Panel>

            {/* TodoList */}
            <Panel>
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-10 rounded-md" />
              </div>
              <div className="mt-3 flex flex-col gap-2.5">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="size-4 shrink-0 rounded-full" />
                    <Skeleton className="h-3 flex-1" style={{ width: `${70 - i * 10}%` }} />
                  </div>
                ))}
              </div>
            </Panel>

            {/* Aksi: Pengambilan / stat */}
            <Panel>
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="mt-auto h-3 w-24" />
            </Panel>

            {/* Aksi: Penjualan */}
            <Panel>
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="mt-auto h-3 w-20" />
            </Panel>

            {/* Ringkasan Servis: gauge + Masuk/Selesai/Diambil */}
            <Panel className="max-sm:col-span-2">
              <Skeleton className="h-3 w-28" />
              <div className="mt-2 grid flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                <Skeleton className="size-16 rounded-full sm:size-20" />
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-2.5 w-12" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-2.5 w-14" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-2.5 w-14" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                </div>
              </div>
            </Panel>

            {/* Kartu lebar (servis selesai/target) */}
            <Panel className="max-sm:col-span-2 sm:col-span-2">
              <Skeleton className="h-3 w-36" />
              <div className="mt-3 flex flex-col gap-2.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-2/3" />
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
