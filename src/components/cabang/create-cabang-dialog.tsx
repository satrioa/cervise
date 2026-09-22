"use client";

import { useState } from "react";
import { BuildingIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { createCabang } from "@/app/app/cabang/actions";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

export function CreateCabangDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [alamat, setAlamat] = useState("");
  const [telepon, setTelepon] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slug = slugify(name);

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) { setError("Nama cabang wajib"); return; }
    if (name.length > 50) { setError("Nama maksimal 50 karakter"); return; }
    setSaving(true);
    try {
      await createCabang({ name, alamat, telepon });
      setName(""); setAlamat(""); setTelepon("");
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      setError(e.message ?? "Gagal membuat cabang");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-background shadow-2xl">
          <div className="flex items-start justify-between border-b px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-foreground/[0.06]">
                <BuildingIcon className="size-4 opacity-80" />
              </div>
              <div>
                <div className="font-heading text-sm">Buat cabang baru</div>
                <div className="mt-0.5 text-muted-foreground text-xs">Bisa diubah nanti di pengaturan.</div>
              </div>
            </div>
            <DialogPrimitive.Close className="rounded-md p-1 text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground">
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="space-y-5 px-5 py-5">
            <div>
              <label className="mb-1.5 block font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Nama cabang</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cervise Cabang 3" maxLength={50} />
              <div className="mt-1.5 text-muted-foreground text-xs">{name.length} / 50</div>
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Slug URL</label>
              <div className="flex h-10 items-center rounded-md border bg-background pl-3 transition-colors focus-within:border-foreground/40">
                <span className="text-muted-foreground text-sm">cervise/</span>
                <code className="flex-1 bg-transparent font-mono text-foreground text-sm outline-none truncate">{slug || "nama-cabang"}</code>
                <span className="mr-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                  <span className="size-1 rounded-full bg-emerald-500" /> tersedia
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Alamat</label>
              <Input value={alamat} onChange={(e) => setAlamat(e.target.value)} placeholder="Jl. Merdeka No. 1, Jakarta" />
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Telepon</label>
              <Input value={telepon} onChange={(e) => setTelepon(e.target.value)} placeholder="0812xxxx" />
            </div>

            {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
          </div>

          <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-5 py-3">
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="button" onClick={handleCreate} disabled={saving || !name.trim()}>
              {saving ? "Menyimpan..." : "Buat cabang"}
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
