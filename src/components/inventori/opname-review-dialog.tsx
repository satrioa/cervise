"use client";

import { useState } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { postSession } from "@/app/app/inventori/opname/actions";
import { summarize, type OpnameLineDraft } from "@/lib/operational/stock-opname";

export function OpnameReviewDialog({
  open,
  onOpenChange,
  sessionId,
  lines,
  canPost,
  onPosted,
  exportSlot,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  lines: OpnameLineDraft[];
  canPost: boolean;
  onPosted: () => void;
  exportSlot?: React.ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const summary = summarize(lines);
  const changed = lines.filter((l) => l.countedQty - l.snapshotQty !== 0);

  const post = async () => {
    setBusy(true);
    try {
      await postSession(sessionId);
      toast.success("Opname diposting — stok diperbarui");
      onOpenChange(false);
      setConfirming(false);
      onPosted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memposting opname");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirming(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tinjau Opname</DialogTitle>
          <DialogDescription>
            Periksa selisih sebelum memposting. Penyesuaian akan tercatat di riwayat stok.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Total {summary.total}</Badge>
          <Badge variant="secondary">Terhitung {summary.counted}</Badge>
          <Badge variant="secondary">Cocok {summary.matched}</Badge>
          <Badge variant="destructive">Kurang {summary.shortage}</Badge>
          <Badge>Lebih {summary.surplus}</Badge>
          <Badge variant="outline" className="tabular-nums">
            Nilai selisih {summary.varianceValue.toLocaleString("id-ID")}
          </Badge>
        </div>

        {summary.shortage > 0 && !confirming ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
          >
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <span>Ada {summary.shortage} baris dengan stok fisik lebih kecil dari sistem.</span>
          </div>
        ) : null}

        <div className="max-h-64 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barang</TableHead>
                <TableHead className="text-right">Sistem</TableHead>
                <TableHead className="text-right">Fisik</TableHead>
                <TableHead className="text-right">Selisih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changed.map((line) => (
                <TableRow key={`${line.refId}-${line.imei ?? ""}`}>
                  <TableCell className="max-w-52">
                    <span className="block truncate font-medium">{line.name}</span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      {line.sku}{line.imei ? ` · ${line.imei}` : ""}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{line.snapshotQty}</TableCell>
                  <TableCell className="text-right tabular-nums">{line.countedQty}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.countedQty - line.snapshotQty}
                  </TableCell>
                </TableRow>
              ))}
              {changed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Tidak ada selisih.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        {confirming ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            Posting akan mengubah stok permanen dan tidak bisa dibatalkan. Lanjutkan?
          </p>
        ) : null}

        <DialogFooter className="flex-wrap gap-2">
          {exportSlot}
          {canPost ? (
            confirming ? (
              <>
                <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                  Batal
                </Button>
                <Button type="button" variant="destructive" loading={busy} onClick={() => void post()}>
                  Ya, posting
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => setConfirming(true)} disabled={summary.counted === 0}>
                Posting Opname
              </Button>
            )
          ) : (
            <span className="text-xs text-muted-foreground">
              Role ini tidak boleh memposting opname.
            </span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
