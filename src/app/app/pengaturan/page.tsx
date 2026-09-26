"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getBrand, getMasterAdmins, updateBrand } from "@/app/app/pengaturan/actions";
import { createMasterAdmin } from "@/app/app/pengaturan/master-admin-actions";
import { uploadTenantLogo, removeTenantLogo } from "@/app/app/pengaturan/photo-actions";
import { PhotoUpload } from "@/components/photo-upload";
import { TempPasswordDialog } from "@/components/temp-password-dialog";
import { useBranch } from "@/lib/branch-context";
import { toast } from "sonner";
import { BuildingIcon, UsersIcon, MailIcon, ShieldIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export default function GeneralPage() {
  const { branch } = useBranch();
  const [brandName, setBrandName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [maName, setMaName] = useState("");
  const [maEmail, setMaEmail] = useState("");
  const [maPhone, setMaPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<{ email: string; tempPassword: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [brand, admins] = await Promise.all([getBrand(branch.id), getMasterAdmins(branch.id)]);
        if (!active) return;
        // Brand berasal dari organizations.name, bukan branches.name ("Cabang
        // Pusat") dan bukan label selector ("Semua cabang").
        if (brand?.name) setBrandName(brand.name);
        setLogoUrl(brand?.logoUrl ?? null);
        setUsers((admins ?? []) as any[]);
      } catch {
        if (active) setUsers([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [branch.id]);

  const handleSaveBrand = async () => {
    setLoading(true);
    try {
      await updateBrand({ name: brandName });
      toast.success("Nama brand disimpan");
    } catch (e: any) {
      toast.error(e.message ?? "Gagal simpan");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMasterAdmin = async () => {
    setCreating(true);
    try {
      const result = await createMasterAdmin({
        fullName: maName,
        email: maEmail,
        phone: maPhone,
        // "Semua cabang" diteruskan apa adanya; server yang me-resolve ke
        // cabang milik actor, karena id itu tidak diketahui di client.
        branchId: branch.id,
      });
      setCreatedAccount({ email: result.email ?? maEmail, tempPassword: result.tempPassword ?? "" });
      setMaName("");
      setMaEmail("");
      setMaPhone("");
    } catch (e: any) {
      toast.error(e.message ?? "Gagal membuat akun");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-svh bg-background">
      <PageHeader
        title="General"
        titleClassName="font-heading text-2xl"
        description="Nama Brand, Logo, dan akses Master Admin per cabang."
        containerClassName="max-w-4xl"
      />

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><BuildingIcon className="size-4" /> Nama Brand & Logo</CardTitle>
          <CardDescription>Terlihat di struk, invoice, dan header cabang</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <PhotoUpload
            photoUrl={logoUrl}
            name={brandName}
            onUpload={uploadTenantLogo}
            onRemove={removeTenantLogo}
            label="Logo tenant"
          />
          <Separator />
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="brand-name">Nama Brand</Label>
              <Input id="brand-name" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Cervise Pusat" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveBrand} disabled={loading}>{loading ? "Menyimpan..." : "Simpan Brand"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldIcon className="size-4" /> Brand access — Master Admin</CardTitle>
          <CardDescription>Kelola siapa yang bisa atur cabang ini. Hanya super_owner & master_admin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ma-name">Nama lengkap</Label>
              <Input id="ma-name" placeholder="Sari Wijaya" value={maName} onChange={(e) => setMaName(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ma-email">Email</Label>
              <div className="relative">
                <MailIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 opacity-50" />
                <Input id="ma-email" placeholder="email@baru.com" value={maEmail} onChange={(e) => setMaEmail(e.target.value)} className="pl-8" />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ma-phone">No HP / WA (opsional)</Label>
              <Input id="ma-phone" placeholder="0812xxxx" value={maPhone} onChange={(e) => setMaPhone(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleCreateMasterAdmin} disabled={creating}>
            {creating ? "Membuat akun..." : "Buat akun Master Admin"}
          </Button>
          <Separator />
          <div className="space-y-2">
            {users.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Belum ada Master Admin di cabang ini.</div>
            ) : (
              users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Avatar className="size-8"><AvatarFallback className="text-xs">{(u.full_name ?? u.email ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{u.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground truncate flex items-center gap-1"><MailIcon className="size-3" />{u.email}</div>
                  </div>
                  <Badge variant="secondary" className="capitalize">{u.role}</Badge>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <UsersIcon className="size-3" />
            Akun dibuat langsung dengan password sementara, bukan lewat email verifikasi.
          </p>
        </CardContent>
      </Card>
      </div>

      <TempPasswordDialog
        open={createdAccount !== null}
        onOpenChange={(next: boolean) => { if (!next) setCreatedAccount(null); }}
        email={createdAccount?.email ?? ""}
        password={createdAccount?.tempPassword ?? ""}
      />
    </div>
  );
}
