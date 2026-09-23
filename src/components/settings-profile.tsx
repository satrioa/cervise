"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRoundIcon, ShieldCheckIcon, TrashIcon, UploadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type BranchOpt = { id: string; name: string };

export type SettingsProfileInitial = {
  fullName: string;
  email: string;
  phone: string;
  branchId: string | null;
  role: string;
  cabangOptions: BranchOpt[];
  isMasterAdmin: boolean;
};

export function SettingsProfileCervise({
  initial,
  onSave,
  onResetPassword,
}: {
  initial: SettingsProfileInitial;
  onSave: (data: { fullName: string; phone: string; branchId: string | null }) => Promise<any>;
  onResetPassword: (email: string) => Promise<any>;
}) {
  const [fullName, setFullName] = useState(initial.fullName);
  const [phone, setPhone] = useState(initial.phone);
  const [branchId, setBranchId] = useState<string>(initial.branchId ?? (initial.cabangOptions[0]?.id ?? ""));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFullName(initial.fullName);
    setPhone(initial.phone);
    setBranchId(initial.branchId ?? (initial.cabangOptions[0]?.id ?? ""));
    setDirty(false);
  }, [initial.fullName, initial.phone, initial.branchId, initial.cabangOptions]);

  const avatarSrc = avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName || initial.fullName)}`;

  const checkDirty = (n: string, p: string, b: string) =>
    n.trim() !== initial.fullName.trim() || p.trim() !== initial.phone.trim() || b !== (initial.branchId ?? "");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarUrl(url);
    toast.info("Preview avatar — upload ke storage nanti");
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error("Nama lengkap wajib");
      return;
    }
    if (fullName.trim().length > 80) {
      toast.error("Nama maksimal 80 karakter");
      return;
    }
    setSaving(true);
    try {
      await onSave({ fullName: fullName.trim(), phone: phone.trim(), branchId: initial.isMasterAdmin ? branchId : initial.branchId });
      toast.success("Profil diperbarui");
      setDirty(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await onResetPassword(initial.email);
      toast.success("Link ganti password dikirim ke email");
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal mengirim link");
    }
  };

  const handleDiscard = () => {
    setFullName(initial.fullName);
    setPhone(initial.phone);
    setBranchId(initial.branchId ?? (initial.cabangOptions[0]?.id ?? ""));
    setDirty(false);
  };

  const roleLabel: Record<string, string> = { MASTER_ADMIN: "Master Admin", ADMIN: "Admin", TECHNICIAN: "Teknisi", FRONTLINER: "Frontliner" };
  const cabangLabel = initial.cabangOptions.find((b) => b.id === branchId)?.name ?? initial.cabangOptions.find((b) => b.id === initial.branchId)?.name ?? "-";

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-8 py-12 pb-32">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Pengaturan · Profil</div>
        <h1 className="mt-1 font-heading text-3xl">Profil Anda</h1>
        <p className="mt-1.5 text-muted-foreground text-sm">Kelola identitas akun Cervise. Perubahan cabang hanya untuk Master Admin.</p>

        <Section title="Foto">
          <div className="flex items-center gap-5">
            <img
              alt={fullName || initial.fullName}
              src={avatarSrc}
              className="size-20 shrink-0 rounded-full object-cover ring-1 ring-border/60"
              draggable={false}
            />
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" type="button" onClick={() => fileRef.current?.click()}>
                  <UploadIcon />
                  Upload
                </Button>
                <Button size="sm" variant="ghost" type="button" disabled={!avatarUrl} onClick={() => { setAvatarUrl(null); toast.info("Avatar dihapus"); }}>
                  Remove
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">Rekomendasi: 400×400 PNG/JPG. Preview lokal sebelum upload ke storage.</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </Section>

        <Separator className="my-8" />

        <Section title="Identitas">
          <Field label="Nama lengkap" htmlFor="p-name">
            <Input id="p-name" value={fullName} onChange={(e) => { setFullName(e.target.value); setDirty(checkDirty(e.target.value, phone, branchId)); }} maxLength={80} nativeInput />
            <p className="text-muted-foreground text-xs">{fullName.length} / 80</p>
          </Field>
          <Field label="No HP / WA" htmlFor="p-phone">
            <Input id="p-phone" value={phone} onChange={(e) => { setPhone(e.target.value); setDirty(checkDirty(fullName, e.target.value, branchId)); }} placeholder="0812xxxx" nativeInput />
          </Field>
          <Field label="Cabang" htmlFor="p-cabang">
            {initial.isMasterAdmin ? (
              <Select value={branchId} onValueChange={(v) => { const nv = (v as string) ?? ""; setBranchId(nv); setDirty(checkDirty(fullName, phone, nv)); }}>
                <SelectTrigger id="p-cabang"><SelectValue placeholder="Pilih cabang" /></SelectTrigger>
                <SelectContent>{initial.cabangOptions.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}</SelectContent>
              </Select>
            ) : (
              <div className="flex h-9 items-center rounded-lg border border-input bg-muted/40 px-3 text-sm">
                <span className="truncate">{cabangLabel}</span>
                <Badge variant="outline" className="ml-auto font-mono text-[10px]">Read-only</Badge>
              </div>
            )}
            {!initial.isMasterAdmin && <p className="text-muted-foreground text-xs">Hanya Master Admin dapat mengganti cabang.</p>}
          </Field>
          <Field label="Peran" htmlFor="p-role">
            <div className="flex h-9 items-center rounded-lg border border-input bg-muted/40 px-3">
              <Badge variant="secondary" className="font-mono text-[10px] uppercase">{roleLabel[initial.role] ?? initial.role}</Badge>
            </div>
          </Field>
        </Section>

        <Separator className="my-8" />

        <Section title="Locale">
          <Field label="Email" htmlFor="p-email">
            <Input id="p-email" type="email" value={initial.email} readOnly nativeInput className="bg-muted/40" />
            <p className="text-muted-foreground text-xs">Email tidak dapat diubah.</p>
          </Field>
        </Section>

        <Separator className="my-8" />

        <Section title="Keamanan">
          <SecurityRow icon={<KeyRoundIcon className="size-4" />} title="Ganti password" description={`Kirim link reset ke ${initial.email}`} cta="Kirim link" onAction={handleReset} />
          <SecurityRow icon={<ShieldCheckIcon className="size-4" />} title="Sesi aktif" description="1 perangkat · terakhir aktif sekarang" cta="Kelola" onAction={() => toast.info("Manajemen sesi segera hadir")} />
        </Section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-8 py-3">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">{dirty ? "Unsaved changes" : "All saved"}</div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" type="button" disabled={!dirty || saving} onClick={handleDiscard}>Discard</Button>
            <Button size="sm" type="button" disabled={!dirty || saving} onClick={handleSave}>{saving ? "Menyimpan..." : "Save changes"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-heading text-base">{title}</h2>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}
function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}
function SecurityRow({ icon, title, description, cta, onAction }: { icon: React.ReactNode; title: string; description: string; cta: string; onAction: () => void }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/60 bg-background/40 p-3.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground/[0.06]">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm">{title}</div>
        <p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
      </div>
      <Button variant="ghost" size="sm" type="button" onClick={onAction}>{cta}</Button>
    </div>
  );
}

// Keep showcase export for shadcn registry compatibility
export function SettingsProfileShowcasePage() {
  return (
    <SettingsProfileCervise
      initial={{ fullName: "Master Admin", email: "admin@cervise.local", phone: "0812000000", branchId: null, role: "MASTER_ADMIN", cabangOptions: [{ id: "1", name: "Cervise Pusat" }], isMasterAdmin: true }}
      onSave={async () => {}}
      onResetPassword={async () => {}}
    />
  );
}
