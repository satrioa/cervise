import { Skeleton } from "@/components/ui/skeleton";
import { RouteFiltersSkeleton, RouteHeaderSkeleton } from "@/components/ui/route-skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Kerangka route Customer.
 *
 * Tabel customer: Customer, HP (WA), Total Servis, Total Spent, Terakhir,
 * dan aksi.
 */
export default function Loading() {
  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <RouteHeaderSkeleton
          titleWidth="7rem"
          descriptionWidth="24rem"
          action
        />

        <RouteFiltersSkeleton chips={3} />

        <div className="rounded-xl border bg-card shadow-xs/5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">Customer</TableHead>
                <TableHead>HP (WA)</TableHead>
                <TableHead>Total Servis</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Terakhir</TableHead>
                <TableHead className="pe-4 w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 8 }, (_, row) => (
                <TableRow key={row}>
                  <TableCell className="ps-4">
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5" style={{ width: `${45 + ((row * 13) % 30)}%` }} />
                      <Skeleton className="h-2.5" style={{ width: `${30 + ((row * 7) % 25)}%` }} />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-3 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-3 w-24" /></TableCell>
                  <TableCell>
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </TableCell>
                  <TableCell className="pe-4"><Skeleton className="size-6 rounded-full" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
