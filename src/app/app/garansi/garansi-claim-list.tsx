"use client";

import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { GaransiClaimRow } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function claimStatusLabel(status: string) {
  if (status === "Sudah Diambil") return "Selesai";
  if (status === "Batal") return "Dibatalkan";
  if (status === "Dikerjakan" || status === "Selesai") return "Diperiksa";
  if (status === "Diajukan") return "Diajukan";
  return "Diajukan";
}

export function GaransiClaimList({ claims }: { claims: GaransiClaimRow[] }) {
  if (claims.length === 0) {
    return <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">Belum ada klaim garansi.</div>;
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="overflow-x-auto scrollbar-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">Tanggal</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Alasan</TableHead>
              <TableHead>Status klaim</TableHead>
              <TableHead className="pe-4">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.map((claim) => (
              <TableRow key={claim.id}>
                <TableCell className="ps-4 font-mono text-xs">{format(new Date(claim.createdAt), "d MMM yyyy", { locale: localeId })}</TableCell>
                <TableCell className="text-sm font-medium">{claim.customerName}</TableCell>
                <TableCell className="font-mono text-xs">{claim.device}</TableCell>
                <TableCell className="max-w-56 truncate text-xs text-muted-foreground" title={claim.reason}>{claim.reason}</TableCell>
                <TableCell><Badge variant="outline" size="sm">{claimStatusLabel(claim.status)}</Badge></TableCell>
                <TableCell className="pe-4">
                  <div className="flex flex-wrap gap-3 text-xs">
                    {claim.newServiceId ? <a className="underline" href={`/app/servis/${claim.newServiceId}`}>Servis klaim</a> : null}
                    <a className="underline" href={`/app/servis/${claim.originalServiceId}`}>Servis asli</a>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
