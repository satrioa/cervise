"use client";

import { useEffect, useState } from "react";
import { KeyRoundIcon, ShieldCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { PhotoUpload } from "@/components/photo-upload";
import { uploadAccountPhoto, removeAccountPhoto } from "@/app/app/pengaturan/photo-actions";

type BranchOpt = { id: string; name: string };

export type SettingsProfileInitial = {
  fullName: string;
  email: string;
  phone: string;
  branchId: string | null;
  role: string;
  cabangOptions: BranchOpt[];
  isMasterAdmin: boolean;
  /** URL foto publik dari server; null = belum ada foto. */
  avatarUrl?: string | null;
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
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(initial.fullName);
    setPhone(initial.phone);
    setBranchId(initial.branchId ?? (initial.cabangOptions[0]?.id ?? ""));
    setDirty(false);
  }, [initial.fullName, initial.phone, initial.branchId, initial.cabangOptions]);

  const checkDirty = (n: string, p: string, b: string) =>
    n.trim() !== initial.fullName.trim() || p.trim() !== initial.phone.trim() || b !== (initial.branchId ?? "");

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
    <div className="min-h-svh bg-transparent text-foreground">
      <PageHeader
        title="Profil Anda"
        titleClassName="font-heading text-2xl"
        description="Kelola identitas akun Cervise. Perubahan cabang hanya untuk Master Admin."
        containerClassName="max-w-3xl"
      />
      <div className="mx-auto max-w-3xl px-8 py-8 pb-32">

        <Section title="Foto">
          <PhotoUpload
            photoUrl={initial.avatarUrl ?? null}
            name={fullName || initial.email}
            onUpload={uploadAccountPhoto}
            onRemove={removeAccountPhoto}
          />
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

      {/* Dock action, sama seperti bulk dock di halaman servis: melayang di
          tengah, bukan melebar penuh. Bentuk yang lama memakai
          `fixed inset-x-0`, jadi lebarnya ikut seluruh viewport dan menutupi
          sidebar saat scroll ke bawah.

          Dock ini juga hanya muncul saat ada perubahan yang belum disimpan.
          sebelumnya bar-nya selalu ada dan menulis "All saved" - sekarang
          tidak ada perubahan berarti tidak ada yang perlu dikonfirmasi, jadi
          tidak ada yang memenuhi layar. */}
      {dirty ? (
        <div className="fixed bottom-[84px] left-1/2 z-40 flex w-fit max-w-[calc(100vw-16px)] -translate-x-1/2 items-center gap-3 rounded-2xl border bg-background/95 px-3 py-2.5 shadow-2xl shadow-black/15 backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl animate-in slide-in-from-bottom-2 fade-in-0 lg:bottom-6">
          <div aria-hidden className="absolute -top-1.5 left-1/2 hidden h-1 w-10 -translate-x-1/2 rounded-full bg-foreground/10 lg:block" />
          <span className="px-1 text-sm font-medium whitespace-nowrap">Ada perubahan</span>
          <span aria-hidden className="hidden h-4 w-px bg-border/60 sm:block" />
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" type="button" disabled={saving} onClick={handleDiscard}>
              Buang
            </Button>
            <Button size="sm" type="button" disabled={saving} onClick={handleSave}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      ) : null}
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
