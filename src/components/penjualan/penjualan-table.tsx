"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { EllipsisIcon } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

type Row = {
  id: string;
  sale_number: string;
  customerName: string;
  customerPhone: string;
  itemsQty: number;
  total: number;
  paid: number;
  payment_method: string | null;
  payment_status: string;
  status: string;
  kas_date: string;
  created_at: string;
};

export function PenjualanTable({ rows, onDetail, onPrint, onRetur }: { rows: Row[]; onDetail: (id: string) => void; onPrint: (id: string) => void; onRetur: (id: string) => void }) {
  const statusTone = (s: string) => {
    if (s === "retur") return "border-destructive/30 text-destructive bg-destructive/5";
    if (s === "selesai") return "border-emerald-500/30 text-emerald-700 bg-emerald-500/10";
    return "border-amber-500/30 text-amber-700";
  };
  const payTone = (p: string) => {
    if (p === "lunas") return "bg-emerald-500";
    if (p === "dp") return "bg-amber-500";
    return "bg-muted-foreground/40";
  };

  return (
    <div className="rounded-xl border bg-card shadow-xs/5 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="ps-4">Nota</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Items</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Metode</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pe-4 w-px" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Belum ada penjualan — klik Transaksi Baru</TableCell></TableRow>
          ) : rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="ps-4 font-mono text-xs tabular-nums">{r.sale_number}</TableCell>
              <TableCell className="font-mono text-xs tabular-nums">{format(new Date(r.kas_date), "d MMM yyyy", { locale: localeId })}</TableCell>
              <TableCell>
                <div className="font-medium text-sm truncate max-w-[160px]">{r.customerName}</div>
                <div className="text-xs text-muted-foreground font-mono">{r.customerPhone}</div>
              </TableCell>
              <TableCell><Badge variant="secondary" size="sm" className="font-mono tabular-nums">{r.itemsQty} SKU</Badge></TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">{formatCurrencyPlain(Number(r.total))}</TableCell>
              <TableCell><Badge variant="outline" size="sm" className="font-mono text-[10px]">{r.payment_method ?? "-"}</Badge></TableCell>
              <TableCell>
                <div className="inline-flex items-center gap-1.5">
                  <span className={"size-1.5 rounded-full " + payTone(r.payment_status)} />
                  <Badge variant="outline" size="sm" className={"font-mono text-[10px] " + statusTone(r.status)}>{r.status}</Badge>
                </div>
              </TableCell>
              <TableCell className="pe-4">
                <Menu>
                  <MenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions ${r.sale_number}`} />}><EllipsisIcon /></MenuTrigger>
                  <MenuPopup align="end">
                    <MenuItem onClick={() => onDetail(r.id)}>Lihat nota</MenuItem>
                    <MenuItem onClick={() => onPrint(r.id)}>Cetak nota</MenuItem>
                    <MenuItem onClick={() => onRetur(r.id)}>Retur parsial</MenuItem>
                  </MenuPopup>
                </Menu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}