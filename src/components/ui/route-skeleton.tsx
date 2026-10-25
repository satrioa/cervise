import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableRowsSkeleton, type TableSkeletonCell } from "@/components/ui/skeleton-shapes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Kerangka untuk `loading.tsx` route.
 *
 * `loading.tsx` dipakai Next.js saat server menyiapkan data route. Karena itu
 * isinya harus server-rendered (tanpa "use client") dan bentuknya harus
 * sama dengan halaman yang akan menggantikannya — kalau tidak, halaman
 * melompat begitu data arrive.
 */

/** Kepala halaman: judul, deskripsi, dan tombol aksi di kanan. */
export function RouteHeaderSkeleton({
  titleWidth = "12rem",
  descriptionWidth = "20rem",
  description = true,
  action = true,
}: {
  titleWidth?: string;
  descriptionWidth?: string;
  description?: boolean;
  action?: boolean;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <Skeleton className="h-6" style={{ width: titleWidth, maxWidth: "100%" }} />
        {description ? (
          <Skeleton className="mt-2 h-3.5" style={{ width: descriptionWidth, maxWidth: "100%" }} />
        ) : null}
      </div>
      {action ? <Skeleton className="h-8 w-28 shrink-0 rounded-lg" /> : null}
    </div>
  );
}

/** Deretan kartu statistik: label kecil + bar nilai besar. */
export function StatCardsSkeleton({
  count = 4,
  columns = "lg:grid-cols-4",
}: {
  count?: number;
  columns?: string;
}) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${columns}`}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-xl border border-border/60 bg-background/40 p-4">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="mt-2.5 h-7 w-28" />
        </div>
      ))}
    </div>
  );
}

/**
 * Kartu berisi tabel: judul kartu + deskripsi + header tabel asli + baris
 * skeleton. `heads` ditulis persis seperti header tabel yang sebenarnya.
 */
export function DataTableCardSkeleton({
  title,
  description,
  heads,
  cells,
  rows = 5,
}: {
  title: string;
  description?: string;
  heads: string[];
  cells: TableSkeletonCell[];
  rows?: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {heads.map((head, index) => (
                <TableHead key={index}>{head}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRowsSkeleton cells={cells} rows={rows} />
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Baris filter di bawah header: kotak pencarian + beberapa chip. */
export function RouteFiltersSkeleton({ chips = 3 }: { chips?: number }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Skeleton className="h-8 w-full rounded-lg sm:w-64" />
      <div className="flex items-center gap-2">
        {Array.from({ length: chips }, (_, index) => (
          <Skeleton key={index} className="h-8 w-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * Kartu produk (grid POS / katalog): ikon besar di kiri, nama + baris
 * meta di tengah, badge stok dan harga di kanan.
 */
export function ProductCardsSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3",
        className,
      )}
    >
      {Array.from({ length: count }, (_, row) => (
        <div
          key={row}
          className="flex flex-row gap-2.5 items-center rounded-xl border bg-card p-2.5 shadow-xs/5"
        >
          <Skeleton className="size-14 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
            <div className="flex items-start justify-between gap-1.5">
              <div className="min-w-0 flex-1 space-y-1">
                <Skeleton className="h-3" style={{ width: `${52 + ((row * 11) % 30)}%` }} />
                <Skeleton className="h-2.5" style={{ width: `${34 + ((row * 7) % 24)}%` }} />
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Skeleton className="h-4 w-14 rounded-full" />
                <Skeleton className="h-4 w-10 rounded-full" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
