import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { LaporanServisExport } from "@/components/laporan-servis-export";

export default function LaporanServisPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Laporan · Servis</div>
            <h1 className="mt-1 font-heading text-2xl">Laporan Servis</h1>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-10 py-8">
        <Card>
          <CardHeader><CardTitle className="text-base">Filter & Export Servis</CardTitle><CardDescription>Rentang tanggal, per teknisi/cabang, export Excel/PDF</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5"><Label>Tanggal Awal</Label><Popover><PopoverTrigger render={<Button variant="outline" className="w-full justify-start" />}>01/09/2026</PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={new Date()} /></PopoverContent></Popover></div>
            <div className="space-y-1.5"><Label>Tanggal Akhir</Label><Popover><PopoverTrigger render={<Button variant="outline" className="w-full justify-start" />}>21/09/2026</PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={new Date()} /></PopoverContent></Popover></div>
            <div className="space-y-1.5"><Label>Cabang</Label><Select><SelectTrigger><SelectValue placeholder="Semua cabang" /></SelectTrigger><SelectContent><SelectItem value="all">Semua</SelectItem><SelectItem value="pusat">Cervise Pusat</SelectItem><SelectItem value="cabang2">Cervise Cabang 2</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Teknisi</Label><Select><SelectTrigger><SelectValue placeholder="Semua teknisi" /></SelectTrigger><SelectContent><SelectItem value="all">Semua</SelectItem><SelectItem value="budi">Budi</SelectItem><SelectItem value="sari">Sari</SelectItem></SelectContent></Select></div>
            <div className="sm:col-span-4 flex gap-2 pt-2">
              <LaporanServisExport />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
