import { RouteHeaderSkeleton } from "@/components/ui/route-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Kerangka route Usage.
 *
 * Tiga kartu ringkasan (Hari ini, Bulan ini, Sisa kuota dengan progress bar),
 * tabel 7 hari terakhir, lalu daftar per cabang.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <RouteHeaderSkeleton
        titleWidth="8rem"
        descriptionWidth="24rem"
        action={false}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((card) => (
          <Card key={card}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3.5 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-6 w-14" />
              {card === 2 ? <Skeleton className="mt-2 h-2 w-full rounded-full" /> : null}
              <Skeleton className="mt-1.5 h-2.5 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">7 Hari Terakhir (count)</CardTitle>
          <CardDescription>Jumlah servis per kas_date</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Bar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 7 }, (_, row) => (
                <TableRow key={row}>
                  <TableCell><Skeleton className="h-3 w-36" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="ml-auto h-3 w-8" /></TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-2 w-24 rounded-full" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per Cabang</CardTitle>
          <CardDescription>Count per cabang — untuk hitung kuota</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center justify-between rounded-lg border p-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
