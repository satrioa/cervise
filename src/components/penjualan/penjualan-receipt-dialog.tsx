"use client";

import type { CSSProperties } from "react";
import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Posisi tetap (bukan acak) supaya tidak ada dua render yang berbeda.
const CONFETTI = Array.from({ length: 24 }, (_, i) => ({
  left: (i * 37 + 7) % 100,
  delay: (i % 8) * 0.08,
  dx: ((i % 5) - 2) * 28,
  rot: 180 + (i % 7) * 90,
  color: ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#a855f7"][i % 5],
}));

export function PenjualanReceiptDialog({
  open,
  html,
  subtitle,
  printing,
  onPrint,
  onClose,
}: {
  open: boolean;
  /** HTML nota yang sama dengan yang dicetak. */
  html: string;
  subtitle: string;
  printing: boolean;
  onPrint: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="overflow-hidden sm:max-w-md">
        {open && (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {CONFETTI.map((c, i) => (
              <span
                key={i}
                className="penjualan-confetti"
                style={{
                  left: `${c.left}%`,
                  animationDelay: `${c.delay}s`,
                  "--dx": `${c.dx}px`,
                  "--rot": `${c.rot}deg`,
                  backgroundColor: c.color,
                } as CSSProperties}
              />
            ))}
          </div>
        )}

        <DialogHeader>
          <DialogTitle>Pembayaran berhasil</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <iframe title="Preview nota" srcDoc={html} className="h-[52vh] w-full rounded-lg border bg-white" />

        <DialogFooter>
          <Button variant="outline" onClick={onPrint} disabled={printing} loading={printing}>
            <PrinterIcon className="size-4" /> Cetak Nota
          </Button>
          <Button onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
