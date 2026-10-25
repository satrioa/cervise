import { Skeleton } from "@/components/ui/skeleton";
import { RouteFiltersSkeleton, RouteHeaderSkeleton } from "@/components/ui/route-skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Kerangka route Audit Log.
 *
 * Tabel jejak aktivitas: Waktu, Aktor (avatar + nama + role), Aksi (badge),
 * Detail, dan Cabang.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
      <RouteHeaderSkeleton
        titleWidth="8rem"
        descriptionWidth="24rem"
        action={false}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>

      <RouteFiltersSkeleton chips={2} />

      <div className="mt-4 overflow-x-auto rounded-xl border bg-card shadow-xs/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">Waktu</TableHead>
              <TableHead>Aktor</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>Cabang</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }, (_, row) => (
              <TableRow key={row}>
                <TableCell className="ps-4"><Skeleton className="h-3 w-36" /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-6 shrink-0 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3" style={{ width: `${45 + ((row * 13) % 30)}%` }} />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-3" style={{ width: `${35 + ((row * 7) % 30)}%` }} /></TableCell>
                <TableCell><Skeleton className="h-3 w-24" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
