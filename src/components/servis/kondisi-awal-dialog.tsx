"use client";

import { useState, useEffect } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { KONDISI_ITEMS, type KondisiAwal } from "@/lib/servis-constants";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (data: KondisiAwal) => Promise<void>;
  onSkip: () => void;
};

export function KondisiAwalDialog({ open, onOpenChange, onSave, onSkip }: Props) {
  const [data, setData] = useState<KondisiAwal>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const init: KondisiAwal = {};
      KONDISI_ITEMS.forEach((k) => (init[k] = { status: "normal", note: "" }));
      setData(init);
    }
  }, [open]);

  const setStatus = (key: string, status: "normal" | "tidak_normal") => {
    setData((prev) => ({ ...prev, [key]: { ...prev[key], status } }));
  };
  const setNote = (key: string, note: string) => {
    setData((prev) => ({ ...prev, [key]: { ...prev[key], note } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(data);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-md supports-backdrop-filter:backdrop-blur-md data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 grid max-h-[85vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          )}
        >
          <div className="px-6 pt-6">
            <DialogPrimitive.Title className="font-semibold text-lg">Check Kondisi Awal</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">Opsional — teknisi cek & tandai. Bisa Lewati tanpa menyimpan.</DialogPrimitive.Description>
          </div>

          <div className="flex-1 overflow-auto px-6 py-4">
            <div className="hidden sm:grid grid-cols-[1fr_180px_1fr] gap-2 px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <span>Item</span>
              <span className="text-center">Kondisi</span>
              <span>Note</span>
            </div>
            <Separator className="mb-3 hidden sm:block" />
            <div className="flex flex-col gap-2">
              {KONDISI_ITEMS.map((item) => {
                const st = data[item]?.status ?? "normal";
                return (
                  <div key={item} className="grid grid-cols-1 sm:grid-cols-[1fr_180px_1fr] gap-2 items-center rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5">
                    <span className="text-sm font-medium">{item}</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setStatus(item, "normal")}
                        className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${st === "normal" ? "bg-emerald-500 text-white border-emerald-600" : "bg-background hover:bg-muted border-border"}`}
                      >
                        Normal
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(item, "tidak_normal")}
                        className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${st === "tidak_normal" ? "bg-amber-500 text-white border-amber-600" : "bg-background hover:bg-muted border-border"}`}
                      >
                        Tidak Normal
                      </button>
                    </div>
                    <Input placeholder="Catatan (opsional)" value={data[item]?.note ?? ""} onChange={(e) => setNote(item, e.target.value)} className="h-8 text-sm" />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-4">
            <Button variant="ghost" onClick={onSkip} disabled={saving}>
              Lewati
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan Kondisi"}
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
