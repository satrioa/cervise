"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BuildingIcon, XIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { createTenant } from "@/app/owner/actions";

export function CreateTenantDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [paket, setPaket] = useState<"trial" | "basic" | "pro">("trial");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Nama tenant wajib"); return; }
    setSaving(true);
    try {
      await createTenant({ name: name.trim(), paket });
      toast.success(`Tenant "${name}" dibuat — paket ${paket}`);
      setName("");
      setPaket("trial");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal buat tenant");
    } finally { setSaving(false); }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" /> Buat Tenant
      </Button>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-0 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
                <BuildingIcon className="size-4" />
              </div>
              <div>
                <DialogPrimitive.Title className="font-heading text-base font-semibold">Buat Tenant Baru</DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-muted-foreground">Tenant baru akan aktif dengan paket terpilih.</DialogPrimitive.Description>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Nama Tenant *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cervise Toko Baru" maxLength={120} />
              <div className="text-xs text-muted-foreground">{name.length} / 120</div>
            </div>
            <div className="space-y-1.5">
              <Label>Paket *</Label>
              <Select value={paket} onValueChange={(v) => setPaket((v as any) ?? "trial")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial — 14 hari</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t bg-muted/20 px-6 py-3 shrink-0">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleCreate} disabled={saving} loading={saving}>Buat Tenant</Button>
          </div>
          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
    </>
  );
}
