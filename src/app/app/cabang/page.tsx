import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CabangPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Manajemen · Cabang</div>
            <h1 className="mt-1 font-heading text-2xl">Cabang</h1>
          </div>
          <Button size="sm">Tambah Cabang</Button>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-10 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Form Cabang</CardTitle>
              <CardDescription>Nama, alamat opsional, telepon. Paket ikut global.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5"><Label>Nama Cabang</Label><Input placeholder="Cervise Cabang 3" /></div>
              <div className="space-y-1.5"><Label>Alamat (opsional)</Label><Input placeholder="Jl. ..." /></div>
              <div className="space-y-1.5"><Label>Telepon</Label><Input placeholder="0812xxxx" /></div>
              <Button className="w-full mt-2">Simpan Cabang</Button>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Daftar Cabang</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Nama</TableHead><TableHead>Alamat</TableHead><TableHead>Telepon</TableHead><TableHead>Paket</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell>Cervise Pusat</TableCell><TableCell>Jl. Merdeka No.1</TableCell><TableCell>081211111111</TableCell><TableCell><Badge>Pro</Badge></TableCell></TableRow>
                  <TableRow><TableCell>Cervise Cabang 2</TableCell><TableCell>Jl. Pahlawan No.5</TableCell><TableCell>081222222222</TableCell><TableCell><Badge variant="secondary">Basic</Badge></TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
