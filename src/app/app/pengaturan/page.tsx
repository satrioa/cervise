"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/branch-context";
import { toast } from "sonner";
import { UploadIcon, TrashIcon, BuildingIcon, UsersIcon, MailIcon, ShieldIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export default function GeneralPage() {
  const { branch } = useBranch();
  const [brandName, setBrandName] = useState(branch.label);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBrandName(branch.label);
  }, [branch.label]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,email,role").eq("branch_id", branch.id).eq("role", "master_admin");
      if (!data || data.length === 0) {
        const { data: all } = await supabase.from("profiles").select("id,full_name,email,role").eq("role", "master_admin").limit(10);
        setUsers((all as any) ?? []);
      } else {
        setUsers((data as any) ?? []);
      }
      const { data: br } = await supabase.from("cervise_branches").select("name,logo_url").eq("id", branch.id).maybeSingle();
      if (br) {
        setBrandName(br.name ?? branch.label);
        setLogoUrl((br as any).logo_url ?? null);
      }
    })();
  }, [branch.id, branch.label]);

  const handleSaveBrand = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("cervise_branches").update({ name: brandName }).eq("id", branch.id);
      if (error) throw error;
      toast.success("Nama brand disimpan");
    } catch (e: any) {
      toast.error(e.message ?? "Gagal simpan");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    toast.info(`Invite ke ${inviteEmail} (mock) — hubungkan ke supabase.auth.admin.createUser di server action nanti`);
    setInviteEmail("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLogoUrl(url);
    toast.info("Preview logo — upload ke storage cervise_brand_logos nanti");
    e.target.value = "";
  };

  const logoSrc = logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(brandName)}`;

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
          {/* Photo — devl pattern */}
          <div className="flex items-center gap-5">
            <img
              alt={brandName}
              src={logoSrc}
              className="size-20 shrink-0 rounded-full object-cover ring-1 ring-border/60"
              draggable={false}
            />
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" type="button" onClick={() => fileRef.current?.click()}>
                  <UploadIcon />
                  Upload
                </Button>
                <Button size="sm" variant="ghost" type="button" disabled={!logoUrl} onClick={() => { setLogoUrl(null); toast.info("Logo dihapus"); }}>
                  <TrashIcon className="size-4" />
                  Remove
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">Rekomendasi: 400×400 PNG/JPG.</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
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
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MailIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 opacity-50" />
              <Input placeholder="email@baru.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="pl-8" />
            </div>
            <Button onClick={handleInvite}>Invite Master Admin</Button>
          </div>
          <Separator />
          <div className="space-y-2">
            {users.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Belum ada Master Admin di cabang ini. Invite di atas.</div>
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
          <p className="text-xs text-muted-foreground flex items-center gap-1"><UsersIcon className="size-3" /> Invite akan kirim email verifikasi. Role default master_admin.</p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
