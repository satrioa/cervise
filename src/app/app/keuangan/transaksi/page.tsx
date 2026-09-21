import { ArrowDownLeftIcon, ArrowDownToLineIcon, ArrowUpRightIcon, CalendarIcon, RefreshCcwIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

type Direction = "in" | "out";

const STATUS_TONE: Record<string, string> = {
  succeeded: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

export default async function TransaksiPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("cervise_finance_tx").select("id,description,type,amount,kas_date,created_at,branch_id").order("created_at", { ascending: false }).limit(20);
  const { data: branches } = await supabase.from("cervise_branches").select("id,name");

  const branchMap = new Map((branches || []).map((b: any) => [b.id, b.name]));

  const txs = (rows && rows.length > 0 ? rows : [
    { id: "dummy1", description: "Servis SV-001 - iPhone 11", type: "pemasukan", amount: 350000, kas_date: new Date().toISOString().slice(0,10), created_at: new Date().toISOString(), branch_id: null },
    { id: "dummy2", description: "Beli sparepart LCD", type: "pengeluaran", amount: 200000, kas_date: new Date().toISOString().slice(0,10), created_at: new Date().toISOString(), branch_id: null },
  ]).map((r: any) => ({
    id: String(r.id).slice(0,8).toUpperCase(),
    rawId: r.id,
    date: new Date(r.kas_date).toLocaleDateString("id-ID", { month: "short", day: "numeric" }) + " · " + new Date(r.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    description: r.description,
    counterparty: r.branch_id ? (branchMap.get(r.branch_id) || String(r.branch_id).slice(0,6)) : "Cervise Pusat",
    amount: Number(r.amount),
    direction: (r.type === "pemasukan" ? "in" : "out") as Direction,
    method: "tunai" as const,
    status: "succeeded" as const,
  }));

  const inflow = txs.filter((t) => t.direction === "in").reduce((a, b) => a + b.amount, 0);
  const outflow = txs.filter((t) => t.direction === "out").reduce((a, b) => a + b.amount, 0);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Keuangan · Transaksi</div>
            <h1 className="mt-1 font-heading text-2xl">Transaksi</h1>
            <p className="text-muted-foreground text-sm">Cervise · {branchMap.size || 1} cabang · hari ini</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost"><RefreshCcwIcon /> Refresh</Button>
            <Button size="sm" variant="outline"><ArrowDownToLineIcon /> CSV</Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-10 py-8">
        <div className="mb-4 grid grid-cols-3 gap-3">
          <SummaryTile label="Pemasukan" amount={inflow} tone="positive" />
          <SummaryTile label="Pengeluaran" amount={outflow} tone="negative" />
          <SummaryTile label="Net" amount={inflow - outflow} tone="neutral" />
        </div>

        <div className="rounded-xl border bg-card shadow-xs/5">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <InputGroup className="w-64">
              <InputGroupAddon><SearchIcon className="size-4 text-muted-foreground" /></InputGroupAddon>
              <InputGroupInput placeholder="Cari deskripsi, ID, cabang..." />
            </InputGroup>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Select items={[{label:"Semua cabang",value:"all"},{label:"Cervise Pusat",value:"pusat"}]} defaultValue="all">
              <SelectTrigger className="w-36" size="sm"><SelectValue /></SelectTrigger>
              <SelectPopup>
                <SelectItem value="all">Semua cabang</SelectItem>
                <SelectItem value="pusat">Cervise Pusat</SelectItem>
              </SelectPopup>
            </Select>
            <Select items={[{label:"Masuk + Keluar",value:"all"},{label:"Masuk",value:"in"},{label:"Keluar",value:"out"}]} defaultValue="all">
              <SelectTrigger className="w-32" size="sm"><SelectValue /></SelectTrigger>
              <SelectPopup>
                <SelectItem value="all">Masuk + Keluar</SelectItem>
                <SelectItem value="in">Masuk</SelectItem>
                <SelectItem value="out">Keluar</SelectItem>
              </SelectPopup>
            </Select>
            <Select items={[{label:"Hari ini",value:"today"},{label:"7 hari",value:"7d"},{label:"30 hari",value:"30d"}]} defaultValue="today">
              <SelectTrigger className="w-36" size="sm"><CalendarIcon className="text-muted-foreground" /><SelectValue /></SelectTrigger>
              <SelectPopup>
                <SelectItem value="today">Hari ini</SelectItem>
                <SelectItem value="7d">7 hari</SelectItem>
                <SelectItem value="30d">30 hari</SelectItem>
              </SelectPopup>
            </Select>
            <span className="ms-auto font-mono text-[11px] text-muted-foreground">{txs.length} transaksi</span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">Tanggal</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pe-4 text-right">Nominal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txs.map((t) => (
                <TableRow key={t.rawId}>
                  <TableCell className="ps-4 text-muted-foreground tabular-nums text-sm">{t.date}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={"flex size-7 shrink-0 items-center justify-center rounded-full " + (t.direction === "in" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")} aria-hidden>
                        {t.direction === "in" ? <ArrowDownLeftIcon className="size-3.5" /> : <ArrowUpRightIcon className="size-3.5" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{t.description}</div>
                        <div className="font-mono text-muted-foreground text-xs">{t.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.counterparty}</TableCell>
                  <TableCell><Badge variant="outline" size="sm" className="font-mono text-[10px]">Tunai</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={"capitalize " + STATUS_TONE[t.status]}>{t.status}</Badge></TableCell>
                  <TableCell className="pe-4 text-right">
                    <div className={"font-mono tabular-nums " + (t.direction === "in" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                      {t.direction === "in" ? "+" : "−"}Rp {t.amount.toLocaleString("id-ID")}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t p-3">
            <span className="text-muted-foreground text-xs">Menampilkan <span className="text-foreground tabular-nums">1–{txs.length}</span> dari {txs.length}</span>
            <Pagination>
              <PaginationContent>
                <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
                <PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem>
                <PaginationItem><PaginationNext href="#" /></PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </main>
    </div>
  );
}

function SummaryTile({ label, amount, tone }: { label: string; amount: number; tone: "positive" | "negative" | "neutral" }) {
  const sign = tone === "negative" ? "−" : "+";
  const cls = tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : tone === "negative" ? "text-foreground" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs/5">
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">{label}</div>
      <div className={"mt-1.5 font-heading font-semibold text-2xl tabular-nums " + cls}>{sign}Rp {Math.abs(amount).toLocaleString("id-ID")}</div>
    </div>
  );
}
