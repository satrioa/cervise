import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function InvoicePage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Keuangan · Invoice</div>
            <h1 className="mt-1 font-heading text-2xl">Invoice</h1>
          </div>
          <Button size="sm">Buat Invoice</Button>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-10 py-8">
        <Card>
          <CardHeader><CardTitle className="text-base">Daftar Invoice Servis</CardTitle><CardDescription>Invoice per servis, cetak PDF, status lunas/belum</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>No Invoice</TableHead><TableHead>Servis</TableHead><TableHead>Customer</TableHead><TableHead>Nominal</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell className="font-mono text-xs">INV-2026-001</TableCell><TableCell>SV-001 - iPhone 11</TableCell><TableCell>Rina</TableCell><TableCell>Rp 350.000</TableCell><TableCell><Badge className="bg-emerald-600">Lunas</Badge></TableCell></TableRow>
                <TableRow><TableCell className="font-mono text-xs">INV-2026-002</TableCell><TableCell>SV-002 - Samsung</TableCell><TableCell>Agus</TableCell><TableCell>Rp 250.000</TableCell><TableCell><Badge variant="secondary">Belum</Badge></TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
