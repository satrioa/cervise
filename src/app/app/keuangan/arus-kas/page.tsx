import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function ArusKasPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Keuangan · Arus Kas</div>
            <h1 className="mt-1 font-heading text-2xl">Arus Kas</h1>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-10 py-8">
        <div className="grid gap-3 lg:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardDescription>Kas Masuk (Minggu)</CardDescription><CardTitle className="text-xl">Rp 12.400.000</CardTitle></CardHeader><CardContent className="text-xs text-emerald-600">+18% vs minggu lalu</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Kas Keluar (Minggu)</CardDescription><CardTitle className="text-xl">Rp 3.200.000</CardTitle></CardHeader><CardContent className="text-xs text-rose-600">Sparepart & operasional</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Net Arus Kas</CardDescription><CardTitle className="text-xl">Rp 9.200.000</CardTitle></CardHeader><CardContent><Badge className="bg-emerald-600">Surplus</Badge></CardContent></Card>
        </div>
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Ringkasan Harian</CardTitle><CardDescription>Rekap per tanggal, per cabang</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Masuk</TableHead><TableHead>Keluar</TableHead><TableHead>Net</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell>2026-09-21</TableCell><TableCell>Rp 3.800.000</TableCell><TableCell>Rp 650.000</TableCell><TableCell className="font-medium">Rp 3.150.000</TableCell></TableRow>
                <TableRow><TableCell>2026-09-20</TableCell><TableCell>Rp 2.100.000</TableCell><TableCell>Rp 400.000</TableCell><TableCell className="font-medium">Rp 1.700.000</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
