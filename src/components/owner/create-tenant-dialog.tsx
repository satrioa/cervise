"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BuildingIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { createTenant } from "@/app/owner/actions";

export function CreateTenantDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !ownerEmail.trim() || !ownerPhone.trim()) {
      toast.error("Nama tenant, email, dan WhatsApp owner wajib diisi");
      return;
    }

    setSaving(true);
    try {
      await createTenant({
        name: name.trim(),
        ownerEmail: ownerEmail.trim(),
        ownerPhone: ownerPhone.trim(),
      });
      toast.success(`Tenant "${name}" dibuat dengan trial 14 hari`);
      setName("");
      setOwnerEmail("");
      setOwnerPhone("");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat tenant");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" /> Buat Tenant
      </Button>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-0 shadow-2xl">
            <div className="flex items-center gap-3 border-b px-6 py-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
                <BuildingIcon className="size-4" />
              </div>
              <div>
                <DialogPrimitive.Title className="font-heading text-base font-semibold">Buat Tenant Baru</DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-muted-foreground">Tenant otomatis mendapat trial 14 hari.</DialogPrimitive.Description>
              </div>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="tenant-name">Nama Tenant *</Label>
                <Input id="tenant-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Cervise Toko Baru" maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="owner-email">Email Owner *</Label>
                <Input id="owner-email" type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="owner@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="owner-phone">WhatsApp Owner *</Label>
                <Input id="owner-phone" value={ownerPhone} onChange={(event) => setOwnerPhone(event.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" />
              </div>
              <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">Trial 14 hari dibuat otomatis. Pembayaran renewal dan aktivasi paket dikonfirmasi lewat WhatsApp.</p>
            </div>
            <div className="flex justify-end gap-2 border-t bg-muted/20 px-6 py-3">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Batal</Button>
              <Button onClick={handleCreate} disabled={saving} loading={saving}>Buat Tenant</Button>
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Tutup">
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
