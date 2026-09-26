"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Select, SelectTrigger, SelectPopup, SelectItem, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { KerusakanTagInput } from "./kerusakan-tag-input";
import { KelengkapanSelect } from "./kelengkapan-select";
import { GaransiField } from "./garansi-field";
import { CustomerAutocomplete } from "./customer-autocomplete";
import { PatternLock } from "./pattern-lock";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { getTeknisi, updateServis } from "@/app/app/servis/actions";
import type { ServisDetail } from "@/app/app/servis/actions";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

type Props = {
  servisId: string;
  initial: ServisDetail | any;
  onSuccess?: () => void;
  onCancel?: () => void;
};

function initials(name?: string | null) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

export function EditServisForm({ servisId, initial, onSuccess, onCancel }: Props) {
  // prefill from initial
  const [merk, setMerk] = useState(initial.merk ?? "");
  const [tipe, setTipe] = useState(initial.tipe ?? "");
  const [imei1, setImei1] = useState(initial.imei1 ?? "");
  const [imei2, setImei2] = useState(initial.imei2 ?? "");
  const [kerusakan, setKerusakan] = useState<string[]>(initial.kerusakan ?? []);
  const [kelengkapan, setKelengkapan] = useState<string[]>(initial.kelengkapan ?? []);
  const [passwordType, setPasswordType] = useState<"PIN" | "POLA">((initial.password_type as "PIN" | "POLA") ?? "PIN");
  const [passwordValue, setPasswordValue] = useState(initial.password_value ?? "");
  const [custName, setCustName] = useState((initial.cervise_customers as any)?.name ?? "");
  const [custPhone, setCustPhone] = useState((initial.cervise_customers as any)?.phone ?? "");
  const [custAddr, setCustAddr] = useState((initial.cervise_customers as any)?.address ?? "");
  const [teknisiId, setTeknisiId] = useState(initial.teknisi_id ?? "");
  const [garansiVal, setGaransiVal] = useState<number | "">(initial.garansi_value ?? "");
  const [garansiUnit, setGaransiUnit] = useState<"hari" | "bulan" | "tahun">((initial.garansi_unit as any) ?? "hari");
  const [priceEstimasi, setPriceEstimasi] = useState<number | "">(initial.price_estimasi ?? "");

  const [teknisiOpts, setTeknisiOpts] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTeknisi().then(setTeknisiOpts).catch(() => {});
  }, []);

  // lock siapa yang input - readonly
  const creator = (initial as any).creator as { full_name: string | null; email: string | null } | null;
  const creatorName = creator?.full_name ?? "—";
  const creatorEmail = creator?.email ?? null;
  const createdAt = initial.created_at as string | null;

  const initialSnapshot = JSON.stringify({
    merk: initial.merk ?? "",
    tipe: initial.tipe ?? "",
    imei1: initial.imei1 ?? "",
    imei2: initial.imei2 ?? "",
    kerusakan: initial.kerusakan ?? [],
    kelengkapan: initial.kelengkapan ?? [],
    passwordType: initial.password_type ?? "PIN",
    passwordValue: initial.password_value ?? "",
    custName: (initial.cervise_customers as any)?.name ?? "",
    custPhone: (initial.cervise_customers as any)?.phone ?? "",
    custAddr: (initial.cervise_customers as any)?.address ?? "",
    teknisiId: initial.teknisi_id ?? "",
    garansiVal: initial.garansi_value ?? "",
    garansiUnit: initial.garansi_unit ?? "hari",
    priceEstimasi: initial.price_estimasi ?? "",
  });
  const currentSnapshot = JSON.stringify({ merk, tipe, imei1, imei2, kerusakan, kelengkapan, passwordType, passwordValue, custName, custPhone, custAddr, teknisiId, garansiVal, garansiUnit, priceEstimasi });
  const isDirty = initialSnapshot !== currentSnapshot;
  const { confirmLeave } = useUnsavedGuard(isDirty, "Discard changes? Perubahan belum disimpan.");

  const validate = () => {
    if (!teknisiId) return "Teknisi wajib diisi";
    if (!merk.trim()) return "Merk wajib";
    if (!tipe.trim()) return "Tipe wajib";
    if (!imei1.trim()) return "IMEI/SN 1 wajib";
    if (kerusakan.length === 0) return "Kerusakan minimal 1 tag";
    if (!custName.trim()) return "Nama customer wajib";
    if (!custPhone.trim()) return "Kontak WA wajib";
    if (!/^08\d{7,13}$/.test(custPhone.trim()) && !/^62\d{7,13}$/.test(custPhone.trim())) return "Format WA tidak valid (08xxx)";
    if (passwordType === "PIN" && !/^\d{4,8}$/.test(passwordValue.trim())) return "PIN harus 4-8 digit angka";
    if (passwordType === "POLA" && passwordValue.split(",").filter(Boolean).length < 4) return "Pola minimal 4 titik";
    if (garansiVal === "" || Number(garansiVal) <= 0) return "Garansi wajib diisi (>0)";
    if (priceEstimasi !== "" && Number(priceEstimasi) < 0) return "Estimasi tidak valid";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const msg = validate();
    if (msg) { setError(msg); return; }
    setLoading(true);
    try {
      await updateServis({
        id: servisId,
        teknisi_id: teknisiId,
        merk: merk.trim(),
        tipe: tipe.trim(),
        imei1: imei1.trim(),
        imei2: imei2.trim() || undefined,
        kerusakan,
        kelengkapan,
        password_type: passwordType,
        password_value: passwordValue.trim(),
        customer_name: custName.trim(),
        customer_address: custAddr.trim() || undefined,
        customer_phone: custPhone.trim(),
        garansi_value: Number(garansiVal),
        garansi_unit: garansiUnit,
        price_estimasi: priceEstimasi === "" ? null : Number(priceEstimasi),
      });
      onSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (!confirmLeave()) return;
    onCancel?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      {/* Lock siapa yang input */}
      <Card className="border-dashed">
        <CardContent className="p-4 flex gap-3 items-center">
          <Avatar className="size-9 shrink-0"><div className="flex size-full items-center justify-center bg-primary text-primary-foreground text-xs font-medium">{initials(creatorName)}</div></Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium">Siapa yang input · Terkunci</div>
            <div className="font-medium text-sm truncate">{creatorName}</div>
            {creatorEmail && <div className="text-xs text-muted-foreground truncate">{creatorEmail}</div>}
            <div className="text-[11px] text-muted-foreground">{createdAt ? format(new Date(createdAt), "d MMM yyyy HH:mm", { locale: localeId }) : "—"} · tidak bisa diubah</div>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border rounded px-2 py-1">Locked</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Teknisi *</CardTitle><CardDescription>Pilih teknisi penanggung jawab</CardDescription></CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Teknisi *</Label>
            <Select value={teknisiId} onValueChange={(v) => setTeknisiId(v as string)}>
              <SelectTrigger><SelectValue placeholder="Pilih teknisi" /></SelectTrigger>
              <SelectPopup>
                {teknisiOpts.length === 0 ? <SelectItem value="__empty" disabled>Tidak ada teknisi</SelectItem> : teknisiOpts.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name || t.email || t.id.slice(0, 6)}</SelectItem>)}
              </SelectPopup>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Informasi Device</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Merk Handphone *</Label><Input value={merk} onChange={(e) => setMerk(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Tipe Handphone *</Label><Input value={tipe} onChange={(e) => setTipe(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>IMEI / SN 1 *</Label><Input value={imei1} onChange={(e) => setImei1(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>IMEI / SN 2 (Opsional)</Label><Input value={imei2} onChange={(e) => setImei2(e.target.value)} /></div>
          </div>
          <Separator />
          <div className="space-y-1.5"><Label>Kerusakan (Tag) *</Label><KerusakanTagInput value={kerusakan} onChange={setKerusakan} /></div>
          <div className="space-y-1.5"><Label>Kelengkapan</Label><KelengkapanSelect value={kelengkapan} onChange={setKelengkapan} /></div>
          <Separator />
          <div className="space-y-3">
            <Label>Password Device *</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setPasswordType("PIN"); setPasswordValue(""); }} className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium ${passwordType === "PIN" ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted border-border"}`}>PIN</button>
              <button type="button" onClick={() => { setPasswordType("POLA"); setPasswordValue(""); }} className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium ${passwordType === "POLA" ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted border-border"}`}>POLA</button>
            </div>
            {passwordType === "PIN" ? <Input placeholder="Masukkan PIN (4-8 digit)" value={passwordValue} onChange={(e) => setPasswordValue(e.target.value.replace(/\D/g, ""))} maxLength={8} inputMode="numeric" /> : <PatternLock value={passwordValue} onChange={setPasswordValue} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Informasi Customer</CardTitle></CardHeader>
        <CardContent><CustomerAutocomplete name={custName} phone={custPhone} address={custAddr} onNameChange={setCustName} onPhoneChange={setCustPhone} onAddressChange={setCustAddr} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Garansi *</CardTitle><CardDescription>Override 90 hari default saat Sudah Diambil.</CardDescription></CardHeader>
        <CardContent className="space-y-1.5"><Label>Garansi *</Label><GaransiField value={garansiVal} unit={garansiUnit} onValueChange={setGaransiVal} onUnitChange={setGaransiUnit} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Estimasi Biaya <span className="font-normal text-muted-foreground">(Opsional)</span></CardTitle><CardDescription>Perkiraan awal. Total bayar final dari riwayat pembayaran.</CardDescription></CardHeader>
        <CardContent className="space-y-1.5"><Label>Estimasi (Rp)</Label><Input type="number" min={0} placeholder="Kosongkan jika belum tahu" value={priceEstimasi} onChange={(e) => { const v = e.target.value; if (v === "") setPriceEstimasi(""); else setPriceEstimasi(Math.max(0, Number(v))); }} /></CardContent>
      </Card>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>Batal</Button>
        <Button type="submit" disabled={loading}>{loading ? "Menyimpan..." : "Simpan Perubahan"}</Button>
      </div>
    </form>
  );
}
