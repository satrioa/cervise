"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createTenant } from "../actions";

export default function NewTenantPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [paket, setPaket] = useState<"trial" | "basic" | "pro">("trial");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Nama tenant wajib"); return; }
    setSaving(true);
    try {
      const res = await createTenant({ name: name.trim(), paket });
      toast.success(`Tenant "${name}" dibuat — paket ${paket}`);
      router.push("/owner");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal buat tenant");
    } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-lg p-4 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Buat Tenant Baru</CardTitle>
          <CardDescription>Buat tenant baru dengan paket terpilih.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <p className="text-xs text-muted-foreground">Trial trial_ends_at = now+14d (schema.sql:11). Bisa upgrade di Pengaturan.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => router.push("/owner")} disabled={saving}>Batal</Button>
            <Button onClick={handleCreate} disabled={saving} loading={saving}>Buat Tenant</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
