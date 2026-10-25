"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Kerangka untuk `ServisDetailView`.
 *
 * Bentuknya mengikuti urutan isi detail yang sebenarnya: kartu ringkasan
 * (badge tanggal/invoice/status, judul device, harga), tab bar, dua kartu
 * informasi input, kartu informasi device (grid 4 field), lalu kartu customer.
 */
export function ServisDetailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      {/* Kartu ringkasan */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-24 rounded-md" />
              <Skeleton className="h-6 w-36 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-6 w-52" />
            <Skeleton className="mt-2 h-3 w-64" />
          </div>
          <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="grid grid-cols-4 gap-1 border-b pb-2">
        {[0, 1, 2, 3].map((tab) => (
          <Skeleton key={tab} className="h-8 rounded-lg" />
        ))}
      </div>

      {/* Dua kartu: diinput oleh + teknisi */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map((card) => (
          <div key={card} className="flex gap-3 rounded-lg border bg-muted/20 p-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-2.5 w-44" />
            </div>
          </div>
        ))}
      </div>

      {/* Kartu informasi device: grid 4 field */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-2.5 w-48" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((field) => (
            <div key={field} className="space-y-1.5 rounded-lg border bg-card p-3">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          ))}
        </div>
      </div>

      {/* Kartu customer */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2.5 w-52" />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Kerangka untuk form edit servis: baris label + baris input, dikelompokkan
 * per bagian. Bentuknya mengikuti form yang akan dirender.
 */
export function ServisFormSkeleton() {
  return (
    <div aria-hidden className="space-y-5">
      {[0, 1, 2].map((section) => (
        <div key={section} className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((field) => (
              <div key={field} className="space-y-1.5">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
