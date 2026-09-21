import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CustomerPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Customer · Per cabang</div>
            <h1 className="mt-1 font-heading text-2xl">Data Customer</h1>
          </div>
          <Button size="sm">Tambah Customer</Button>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-10 py-8">
        <div className="flex gap-2">
          <Input placeholder="Cari nama / HP / device..." className="max-w-sm" />
          <Button variant="outline">Cari</Button>
        </div>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Customer per Cabang</CardTitle>
            <CardDescription>Isolasi branch — customer cabang A tidak terlihat di cabang B</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>HP (WA)</TableHead>
                  <TableHead>Total Servis</TableHead>
                  <TableHead>Terakhir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Rina</TableCell>
                  <TableCell>0812xxxx</TableCell>
                  <TableCell>3</TableCell>
                  <TableCell>SV-001 - Dikerjakan</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Agus</TableCell>
                  <TableCell>0813xxxx</TableCell>
                  <TableCell>1</TableCell>
                  <TableCell>SV-002 - Menunggu Sparepart</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
