"use client";

import { useState } from "react";
import { PencilIcon, PlusIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { savePackage } from "@/app/owner/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PackageRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthly_price: number;
  branch_limit: number;
  user_limit: number | null;
  is_active: boolean;
  sort_order: number;
};

type FormState = {
  id?: string;
  code: string;
  name: string;
  description: string;
  monthlyPrice: string;
  branchLimit: string;
  userLimit: string;
};

const emptyForm: FormState = {
  code: "",
  name: "",
  description: "",
  monthlyPrice: "199000",
  branchLimit: "1",
  userLimit: "3",
};

function formatRupiah(value: number) {
  return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
}

export function PackageManager({ packages }: { packages: PackageRow[] }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const update = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const reset = () => setForm(emptyForm);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await savePackage({
        id: form.id,
        code: form.code,
        name: form.name,
        description: form.description,
        monthlyPrice: form.monthlyPrice,
        branchLimit: form.branchLimit,
        userLimit: form.userLimit || null,
      });
      toast.success(form.id ? "Package diperbarui" : "Package dibuat");
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan package");
    } finally {
      setSaving(false);
    }
  };

  const edit = (item: PackageRow) => {
    setForm({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description ?? "",
      monthlyPrice: String(item.monthly_price),
      branchLimit: String(item.branch_limit),
      userLimit: item.user_limit === null ? "" : String(item.user_limit),
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader><CardTitle>Package aktif</CardTitle><CardDescription>Harga bulanan dan limit branch yang dipakai tenant.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {packages.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-medium">{item.name}</span><Badge variant={item.is_active ? "success" : "outline"}>{item.is_active ? "active" : "archived"}</Badge></div><div className="mt-1 text-xs text-muted-foreground">{formatRupiah(item.monthly_price)} / bulan · {item.branch_limit} branch · {item.user_limit ?? "∞"} user</div><div className="mt-1 text-xs text-muted-foreground">{item.description || "Tanpa deskripsi"}</div></div>
              <Button type="button" variant="outline" size="sm" onClick={() => edit(item)}><PencilIcon className="size-3.5" /> Edit</Button>
            </div>
          ))}
          {packages.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">Belum ada package.</div> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{form.id ? "Edit package" : "Tambah package"}</CardTitle><CardDescription>Harga disimpan dalam Rupiah penuh.</CardDescription></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submit}>
            <div className="space-y-1.5"><Label htmlFor="package-code">Kode *</Label><Input id="package-code" value={form.code} onChange={(event) => update("code", event.target.value)} placeholder="basic" /></div>
            <div className="space-y-1.5"><Label htmlFor="package-name">Nama *</Label><Input id="package-name" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Basic" /></div>
            <div className="space-y-1.5"><Label htmlFor="package-description">Deskripsi</Label><Input id="package-description" value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Untuk operasional satu toko" /></div>
            <div className="grid grid-cols-2 gap-2"><div className="space-y-1.5"><Label htmlFor="package-price">Harga / bulan *</Label><Input id="package-price" type="number" min="0" value={form.monthlyPrice} onChange={(event) => update("monthlyPrice", event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="package-branch">Branch limit *</Label><Input id="package-branch" type="number" min="1" value={form.branchLimit} onChange={(event) => update("branchLimit", event.target.value)} /></div></div>
            <div className="space-y-1.5"><Label htmlFor="package-user">User limit</Label><Input id="package-user" type="number" min="1" value={form.userLimit} onChange={(event) => update("userLimit", event.target.value)} placeholder="3" /></div>
            <div className="flex gap-2 pt-2"><Button type="submit" loading={saving}><SaveIcon className="size-4" /> Simpan</Button>{form.id ? <Button type="button" variant="outline" onClick={reset}><PlusIcon className="size-4" /> Package baru</Button> : null}</div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
