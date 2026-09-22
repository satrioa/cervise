"use client";

import { useEffect, useState } from "react";
import { UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { createCustomer, updateCustomer } from "@/app/app/customer/actions";
import { useRouter } from "next/navigation";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  initial?: { id: string; name: string; phone: string }; // phone is 62...
  onSuccess?: () => void;
};

function toLocal08(norm62: string): string {
  if (!norm62) return "";
  const d = norm62.replace(/\D/g, "");
  if (d.startsWith("62")) return "0" + d.slice(2);
  return d;
}

export function CustomerDialog({ open, onOpenChange, mode, initial, onSuccess }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(""); // user types 08..., we convert to 62 on submit
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setName(initial.name);
      setPhone(toLocal08(initial.phone));
    } else {
      setName("");
      setPhone("");
    }
    setError(null);
  }, [open, mode, initial]);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) { setError("Nama wajib"); return; }
    if (!phone.trim()) { setError("Telepon wajib (format 08... akan disimpan 62...)"); return; }
    // client preview normalize to 62 for validation hint
    const digits = phone.replace(/\D/g, "");
    let normPreview = digits;
    if (normPreview.startsWith("0")) normPreview = "62" + normPreview.slice(1);
    if (!/^62\d{8,13}$/.test(normPreview)) { setError("Telepon harus 62 + 8-13 digit (contoh 62812xxxxxxx) — ketik 08..."); return; }

    setSaving(true);
    try {
      if (mode === "create") {
        await createCustomer({ name, phone });
      } else if (initial?.id) {
        await updateCustomer(initial.id, { name, phone });
      }
      onOpenChange(false);
      router.refresh();
      onSuccess?.();
    } catch (e: any) {
      setError(e.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-foreground/[0.06]">
              <UserIcon className="size-4 opacity-80" />
            </div>
            <div>
              <DialogPrimitive.Title className="font-heading text-sm">
                {mode === "create" ? "Tambah Customer" : "Edit Customer"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-muted-foreground">
                {mode === "create" ? "Tambah customer baru ke cabang ini." : "Ubah Nama & Telepon — duplikat HP ditolak."}
              </DialogPrimitive.Description>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Nama *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rina Hartati" maxLength={120} />
              <div className="text-xs text-muted-foreground">{name.length} / 120</div>
            </div>
            <div className="space-y-1.5">
              <Label>Telepon *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812xxxxxxx" inputMode="numeric" />
            </div>
            {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? "Menyimpan..." : mode === "create" ? "Tambah" : "Simpan"}</Button>
          </div>

          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
