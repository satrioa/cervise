"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { BarChart3Icon, PackageIcon, WalletIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export default function UsagePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from("cervise_services").select("id,created_at,branch_id").order("created_at", { ascending: false }).limit(200);
      if (data) setRows(data as any[]);
      else setRows([]);
      setLoading(false);
    })();
  }, []);

  const total = rows.length;
  const quota = 100; // trial 100, basic 500, pro 9999 — simple for MVP
  const sisa = Math.max(0, quota - total);
  const pct = Math.min(100, Math.round((total / quota) * 100));

  const last7 = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const d = new Date(r.created_at).toISOString().slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 7)
      .reverse();
  }, [rows]);

  const branchCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const k = r.branch_id ?? "pusat";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()) as [string, number][];
  }, [rows]);

  return (
    <div className="min-h-svh bg-background">
      <PageHeader
        title="Usage"
        titleClassName="font-heading text-2xl"
        description="Count servis — bukan amount. Kuota trial 100, basic 500, pro unlimited."
        innerClassName="max-w-4xl"
      />

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3Icon className="size-4" /> Hari ini</CardTitle></CardHeader>
          <CardContent><div className="font-heading text-2xl tabular-nums">{rows.filter((r) => new Date(r.created_at).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)).length}</div><div className="text-xs text-muted-foreground">servis</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PackageIcon className="size-4" /> Bulan ini</CardTitle></CardHeader>
          <CardContent><div className="font-heading text-2xl tabular-nums">{rows.filter((r) => new Date(r.created_at).toISOString().slice(0, 7) === new Date().toISOString().slice(0, 7)).length}</div><div className="text-xs text-muted-foreground">dari {quota} kuota</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><WalletIcon className="size-4" /> Sisa kuota</CardTitle></CardHeader>
          <CardContent>
            <div className="font-heading text-2xl tabular-nums">{sisa}</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/10"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
            <div className="mt-1 text-xs text-muted-foreground">{pct}% terpakai ({total}/{quota})</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">7 Hari Terakhir (count)</CardTitle><CardDescription>Jumlah servis per kas_date</CardDescription></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Memuat...</div>
          ) : last7.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Belum ada data</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Tanggal</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Bar</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {last7.map(([date, cnt]) => (
                  <TableRow key={date}>
                    <TableCell className="font-mono text-xs">{format(new Date(date + "T12:00:00"), "EEEE, d MMM yyyy", { locale: localeId })}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{cnt}</TableCell>
                    <TableCell className="text-right"><div className="ml-auto h-2 w-24 overflow-hidden rounded-full bg-foreground/10"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (cnt / Math.max(1, Math.max(...last7.map(([, c]) => c)))) * 100)}%` }} /></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Per Cabang</CardTitle><CardDescription>Count per cabang — untuk hitung kuota</CardDescription></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {branchCounts.length === 0 ? (
              <div className="text-sm text-muted-foreground">Belum ada cabang dengan servis</div>
            ) : (
              branchCounts.map(([branch, cnt]) => (
                <div key={branch} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="font-mono text-xs">{branch.slice(0, 8)}</span>
                  <Badge variant="secondary" className="font-mono">{cnt} servis</Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
