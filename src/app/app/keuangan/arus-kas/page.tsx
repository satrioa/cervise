import { ArrowUpRightIcon, ArrowDownRightIcon, WalletIcon, EllipsisIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";

const RINGKASAN = [
  { date: "2026-09-21", masuk: 3800000, keluar: 650000, net: 3150000 },
  { date: "2026-09-20", masuk: 2100000, keluar: 400000, net: 1700000 },
  { date: "2026-09-19", masuk: 1850000, keluar: 820000, net: 1030000 },
  { date: "2026-09-18", masuk: 2600000, keluar: 310000, net: 2290000 },
  { date: "2026-09-17", masuk: 1450000, keluar: 540000, net: 910000 },
];

function formatRp(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export default function ArusKasPage() {
  return (
    <div className="min-h-svh bg-background px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-xl">Arus Kas</h1>
            <p className="text-muted-foreground text-sm">5 hari terakhir · rekap per tanggal, per cabang</p>
          </div>
          <Button size="sm" variant="outline">
            Export CSV
          </Button>
        </header>

        <div className="grid gap-3 lg:grid-cols-3 mb-6">
          <div className="rounded-xl border bg-card p-5 shadow-xs/5">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Kas Masuk (Minggu)</div>
            <div className="mt-1 font-heading text-xl">Rp 12.400.000</div>
            <div className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-600">
              <ArrowUpRightIcon className="size-3" /> +18% vs minggu lalu
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-xs/5">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Kas Keluar (Minggu)</div>
            <div className="mt-1 font-heading text-xl">Rp 3.200.000</div>
            <div className="mt-1 text-xs text-rose-600">Sparepart & operasional</div>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-xs/5">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Net Arus Kas</div>
            <div className="mt-1 font-heading text-xl">Rp 9.200.000</div>
            <div className="mt-2">
              <Badge variant="success">Surplus</Badge>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card shadow-xs/5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">Tanggal</TableHead>
                <TableHead>Masuk</TableHead>
                <TableHead>Keluar</TableHead>
                <TableHead>Net</TableHead>
                <TableHead className="pe-4 w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {RINGKASAN.map((r) => {
                const surplus = r.net >= 0;
                return (
                  <TableRow key={r.date}>
                    <TableCell className="ps-4">
                      <div className="flex items-center gap-2">
                        <span className={"size-1.5 rounded-full " + (surplus ? "bg-emerald-500" : "bg-rose-500")} />
                        <span className="font-mono text-xs tabular-nums">{r.date}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-emerald-600">
                        <ArrowUpRightIcon className="size-3" />
                        {formatRp(r.masuk)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-rose-600">
                        <ArrowDownRightIcon className="size-3" />
                        {formatRp(r.keluar)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <WalletIcon className="size-3 text-muted-foreground" />
                        <span className="font-mono text-xs font-medium tabular-nums">{formatRp(r.net)}</span>
                        <Badge variant={surplus ? "success" : "destructive"} size="sm">
                          {surplus ? "Surplus" : "Defisit"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="pe-4">
                      <Menu>
                        <MenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions ${r.date}`} />}>
                          <EllipsisIcon />
                        </MenuTrigger>
                        <MenuPopup align="end">
                          <MenuItem>Lihat detail</MenuItem>
                          <MenuItem>Export</MenuItem>
                        </MenuPopup>
                      </Menu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
