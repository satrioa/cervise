import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function PerformaPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Laporan · Performa Karyawan</div>
            <h1 className="mt-1 font-heading text-2xl">Performa Karyawan</h1>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-10 py-8">
        <Card>
          <CardHeader><CardTitle className="text-base">Jumlah Servis Selesai per Teknisi</CardTitle><CardDescription>Metrik: Selesai + Sudah Diambil = selesai. Filter tanggal & cabang.</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Teknisi</TableHead><TableHead>Cabang</TableHead><TableHead>Selesai</TableHead><TableHead>Rating</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell>Rudi Teknisi</TableCell><TableCell>Cervise Pusat</TableCell><TableCell><Badge>12 servis</Badge></TableCell><TableCell>4.8</TableCell></TableRow>
                <TableRow><TableCell>Sari Teknisi</TableCell><TableCell>Cervise Cabang 2</TableCell><TableCell><Badge variant="secondary">7 servis</Badge></TableCell><TableCell>4.6</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
