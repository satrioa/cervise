"use client";

import { useEffect, useState } from "react";
import { AlertTriangleIcon, PenLineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import SignaturePad from "@/components/kokonutui/signature-pad";
import { confirmServisPickup } from "@/app/app/servis/sparepart-actions";

export type PickupTarget = {
  id: string;
  servisLabel: string;
  device: string;
};

export function PickupSignatureDialog({
  open,
  onOpenChange,
  targets,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targets: PickupTarget[];
  onSuccess: () => void;
}) {
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSignature(null);
    setError(null);
    setSaving(false);
  }, [open]);

  const ready = Boolean(signature) && signature!.startsWith("<svg");

  const handleConfirm = async () => {
    if (!signature || saving) return;
    setSaving(true);
    setError(null);
    try {
      for (const t of targets) {
        await confirmServisPickup(t.id, signature);
      }
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ?? "Gagal menyimpan tanda tangan");
    } finally {
      setSaving(false);
    }
  };

  const title = "Pengambilan Device";
  const description =
    targets.length > 1
      ? `${targets.length} servis dipilih — satu tanda tangan customer berlaku untuk semua servis yang diambil.`
      : `Tanda tangan customer untuk ${targets[0]?.servisLabel ?? ""} · ${targets[0]?.device ?? ""}`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-background shadow-xl">
          <div className="shrink-0 border-b px-5 py-4">
            <DialogPrimitive.Title className="font-heading text-base font-semibold flex items-center gap-2">
              <PenLineIcon className="size-4" />
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <SignaturePad className="max-w-none" onChange={setSignature} />
            {error && <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center gap-1.5"><AlertTriangleIcon className="size-3.5" />{error}</div>}
          </div>

          <div className="shrink-0 border-t bg-muted/20 px-4 py-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
            <Button onClick={() => void handleConfirm()} disabled={!ready || saving}>
              {saving ? "Menyimpan..." : "Konfirmasi Pengambilan"}
            </Button>
          </div>

          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
