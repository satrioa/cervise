import { RouteHeaderSkeleton } from "@/components/ui/route-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Kerangka route Transaksi Keuangan.
 *
 * Tiga kartu ringkasan (Pemasukan, Pengeluaran, Net) lalu tabel transaksi
 * dengan 5 kolom: Tanggal, Deskripsi, Cabang, Metode, Nominal.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8">
      <RouteHeaderSkeleton
        titleWidth="10rem"
        descriptionWidth="20rem"
        action={false}
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        {["Pemasukan", "Pengeluaran", "Net"].map((label) => (
          <div key={label} className="rounded-xl border bg-card p-4 shadow-xs/5">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">{label}</div>
            <Skeleton className="mt-1.5 h-6 w-28" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card shadow-xs/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">Tanggal</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Cabang</TableHead>
              <TableHead>Metode</TableHead>
              <TableHead className="pe-4 text-right">Nominal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }, (_, row) => (
              <TableRow key={row}>
                <TableCell className="ps-4"><Skeleton className="h-3 w-20" /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-7 shrink-0 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3" style={{ width: `${45 + ((row * 13) % 30)}%` }} />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-3" style={{ width: `${35 + ((row * 7) % 30)}%` }} /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                <TableCell className="pe-4 text-right"><Skeleton className="ml-auto h-3 w-24" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
