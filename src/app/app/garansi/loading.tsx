import { RouteHeaderSkeleton } from "@/components/ui/route-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Kerangka route Garansi.
 *
 * Tabel garansi: No.Invoice, Tanggal, Customer, Device, Expired Date,
 * Sisa Garansi (progress + label), dan aksi.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
      <RouteHeaderSkeleton
        titleWidth="8rem"
        descriptionWidth="22rem"
        action={false}
      />

      <div className="rounded-xl border bg-card shadow-xs/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">No.Invoice</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Expired Date</TableHead>
              <TableHead className="pe-4 min-w-[180px]">Sisa Garansi</TableHead>
              <TableHead className="pe-4 w-px" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }, (_, row) => (
              <TableRow key={row}>
                <TableCell className="ps-4"><Skeleton className="h-3 w-24" /></TableCell>
                <TableCell><Skeleton className="h-3 w-20" /></TableCell>
                <TableCell>
                  <Skeleton className="h-3" style={{ width: `${45 + ((row * 13) % 35)}%` }} />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3" style={{ width: `${35 + ((row * 7) % 30)}%` }} />
                </TableCell>
                <TableCell><Skeleton className="h-3 w-20" /></TableCell>
                <TableCell className="pe-4 min-w-[180px]">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-1.5 w-20 rounded-full" />
                    <Skeleton className="h-2.5 w-10" />
                  </div>
                </TableCell>
                <TableCell className="pe-4"><Skeleton className="size-6 rounded-full" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
