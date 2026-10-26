"use client";

import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ServisPaymentPanel } from "./servis-payment-panel";
import { getPembayaranHistory, getServisDetail } from "@/app/app/servis/actions";

type Props = {
  servisId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaid?: () => void;
};

/**
 * Dialog bayar servis dari luar halaman detail.
 *
 * Halaman detail sudah punya detail + riwayat, jadi panelnya bisa langsung
 * diisi. Dari daftar servis (context menu) datanya belum ada, jadi dialog ini
 * ambil sendiri: patokan tagihan (`price_estimasi`) dan total yang sudah
 * dibayar dari ledger kas.
 */
export function ServisPaymentDialog({ servisId, open, onOpenChange, onPaid }: Props) {
  // Data ditandai dengan key servisnya, jadi pindah servis tidak menyisakan
  // angka servis sebelumnya tanpa perlu reset state di dalam effect.
  const [data, setData] = useState<{ key: string; estimasi: number | null; totalPaid: number } | null>(null);

  useEffect(() => {
    if (!open || !servisId) return;
    let cancelled = false;
    Promise.all([getServisDetail(servisId), getPembayaranHistory(servisId)])
      .then(([detail, history]) => {
        if (cancelled) return;
        setData({
          key: servisId,
          estimasi: (detail as { price_estimasi?: number | null })?.price_estimasi ?? null,
          totalPaid: (history as { amount?: number }[]).reduce((a, b) => a + Number(b.amount ?? 0), 0),
        });
      })
      .catch(() => {
        if (!cancelled) setData({ key: servisId, estimasi: null, totalPaid: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [open, servisId]);

  const ready = data?.key === servisId;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogPrimitive.Title className="font-semibold">Bayar Servis</DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-sm text-muted-foreground">Metode pembayaran sama dengan penjualan.</DialogPrimitive.Description>
          <div className="mt-4">
            {!ready ? (
              <Skeleton className="h-40 w-full" />
            ) : servisId ? (
              <ServisPaymentPanel
                servisId={servisId}
                estimasi={data.estimasi}
                totalPaid={data.totalPaid}
                onSuccess={() => {
                  onPaid?.();
                  onOpenChange(false);
                }}
                onClose={() => onOpenChange(false)}
              />
            ) : null}
          </div>
          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
