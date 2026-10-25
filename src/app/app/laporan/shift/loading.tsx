import { RouteHeaderSkeleton } from "@/components/ui/route-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Kerangka route Laporan Shift.
 *
 * Tabel daftar shift: judul, cabang, frontliner, saldo awal, saldo akhir,
 * selisih, dan aksi.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <RouteHeaderSkeleton
        titleWidth="10rem"
        descriptionWidth="24rem"
        action={false}
      />

      <div className="overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/20 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
              <th className="px-3 py-2 font-normal">Tanggal</th>
              <th className="px-3 py-2 font-normal">Cabang</th>
              <th className="px-3 py-2 font-normal">Frontliner</th>
              <th className="px-3 py-2 text-right font-normal">Saldo awal</th>
              <th className="px-3 py-2 text-right font-normal">Saldo akhir</th>
              <th className="px-3 py-2 text-right font-normal">Selisih</th>
              <th className="px-3 py-2 text-right font-normal">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }, (_, row) => (
              <tr key={row} className="border-b border-border/60">
                <td className="px-3 py-2"><Skeleton className="h-3 w-20" /></td>
                <td className="px-3 py-2"><Skeleton className="h-3" style={{ width: `${45 + ((row * 13) % 35)}%` }} /></td>
                <td className="px-3 py-2"><Skeleton className="h-3" style={{ width: `${35 + ((row * 7) % 30)}%` }} /></td>
                <td className="px-3 py-2 text-right"><Skeleton className="ml-auto h-3 w-20" /></td>
                <td className="px-3 py-2 text-right"><Skeleton className="ml-auto h-3 w-20" /></td>
                <td className="px-3 py-2 text-right"><Skeleton className="ml-auto h-3 w-20" /></td>
                <td className="px-3 py-2 text-right"><Skeleton className="ml-auto h-6 w-14 rounded-md" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
