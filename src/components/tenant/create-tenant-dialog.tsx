"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BuildingIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { createOwnTenant } from "@/app/dashboard/tenant/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { validateRequiredTenantName } from "@/lib/onboarding/validation";

export type TenantCreatePackage = {
  id: string;
  code: string;
  name: string;
  monthly_price: number;
  branch_limit: number;
};

export function CreateTenantDialog({
  packages,
  asTile = false,
}: {
  packages: TenantCreatePackage[];
  asTile?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    const validationError = validateRequiredTenantName(name);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!packageId) {
      toast.error("Pilih paket tenant terlebih dahulu");
      return;
    }

    setSaving(true);
    try {
      const result = await createOwnTenant({
        name,
        branchName,
        packageId,
      });
      setOpen(false);
      setName("");
      setBranchName("");
      setPackageId(packages[0]?.id ?? "");
      playPageTransition();
      router.refresh();
      router.push(result.isPaidPackage ? "/app/pengaturan/subscription" : "/app");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat tenant");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {asTile ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex h-full min-h-[152px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-card/50 p-4 text-center text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-12 items-center justify-center rounded-xl border border-dashed border-current/40 bg-background/60">
            <PlusIcon className="size-6" />
          </span>
          <span className="text-sm font-medium">Tambah Tenant</span>
        </button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <PlusIcon className="size-4" /> Tambah tenant
        </Button>
      )}
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
                <DialogPrimitive.Description className="text-xs text-muted-foreground">Tenant baru mendapat trial 14 hari.</DialogPrimitive.Description>
              </div>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="tenant-name">Nama Tenant *</Label>
                <Input id="tenant-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Cervise Toko Baru" maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-branch">Nama Cabang</Label>
                <Input id="tenant-branch" value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="Cabang Pusat" maxLength={50} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-package">Paket *</Label>
                <select
                  id="tenant-package"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={packageId}
                  onChange={(event) => setPackageId(event.target.value)}
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — Rp {pkg.monthly_price.toLocaleString("id-ID")}/bln · {pkg.branch_limit} cabang
                    </option>
                  ))}
                </select>
              </div>
              <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">Trial 14 hari dibuat otomatis. Paket berbayar membuat invoice dan aktif setelah pembayaran diverifikasi platform admin.</p>
            </div>
            <div className="flex justify-end gap-2 border-t bg-muted/20 px-6 py-3">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Batal</Button>
              <Button onClick={handleCreate} disabled={saving || !name.trim()} loading={saving}>Buat Tenant</Button>
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
