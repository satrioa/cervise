"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectTrigger, SelectPopup, SelectItem, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { KerusakanTagInput } from "./kerusakan-tag-input";
import { KelengkapanSelect } from "./kelengkapan-select";
import { GaransiField } from "./garansi-field";
import { CustomerAutocomplete } from "./customer-autocomplete";
import { PatternLock } from "./pattern-lock";
import { KondisiAwalDialog } from "./kondisi-awal-dialog";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { createServis, getTeknisi, updateKondisiAwal } from "@/app/app/servis/actions";
import type { KondisiAwal } from "@/lib/servis-constants";

type ServisFormProps = {
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function ServisForm({ onSuccess, onCancel }: ServisFormProps) {
  const router = useRouter();

  // device
  const [merk, setMerk] = useState("");
  const [tipe, setTipe] = useState("");
  const [imei1, setImei1] = useState("");
  const [imei2, setImei2] = useState("");
  const [kerusakan, setKerusakan] = useState<string[]>([]);
  const [kelengkapan, setKelengkapan] = useState<string[]>([]);
  const [passwordType, setPasswordType] = useState<"PIN" | "POLA">("PIN");
  const [passwordValue, setPasswordValue] = useState("");

  // customer
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custAddr, setCustAddr] = useState("");

  // teknisi & garansi & estimasi
  const [teknisiId, setTeknisiId] = useState("");
  const [teknisiOpts, setTeknisiOpts] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [garansiVal, setGaransiVal] = useState<number | "">("");
  const [garansiUnit, setGaransiUnit] = useState<"hari" | "bulan" | "tahun">("hari");
  const [priceEstimasi, setPriceEstimasi] = useState<number | "">("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // post-save kondisi dialog
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showKondisi, setShowKondisi] = useState(false);

  useEffect(() => {
    getTeknisi().then(setTeknisiOpts).catch(() => {});
  }, []);

  const isDirty =
    !!merk || !!tipe || !!imei1 || !!imei2 || kerusakan.length > 0 || kelengkapan.length > 0 || !!passwordValue || !!custName || !!custPhone || !!custAddr || !!teknisiId || garansiVal !== "" || priceEstimasi !== "";

  const { confirmLeave } = useUnsavedGuard(isDirty && !savedId, "Discard changes? Perubahan belum disimpan.");

  // handle before route leave via click handler will use confirmLeave

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
    if (msg) {
      setError(msg);
      return;
    }
    setLoading(true);
    try {
      const res = await createServis({
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
      setSavedId(res.id);
      setShowKondisi(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  };

  const handleKondisiSave = async (data: KondisiAwal) => {
    if (!savedId) return;
    await updateKondisiAwal(savedId, data);
    if (onSuccess) onSuccess();
    else router.push("/app/servis");
    // refresh after save
    router.refresh();
  };
  const handleSkip = () => {
    if (onSuccess) onSuccess();
    else router.push("/app/servis");
    router.refresh();
  };

  const handleCancel = () => {
    if (!confirmLeave()) return;
    if (onCancel) onCancel();
    else if (onSuccess) onSuccess();
    else router.push("/app/servis");
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-0 py-6">
        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

        {/* Teknisi - wajib */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Teknisi *</CardTitle>
            <CardDescription>Pilih teknisi penanggung jawab servis ini</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label>Teknisi *</Label>
              <Select value={teknisiId} onValueChange={(v) => setTeknisiId(v as string)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih teknisi" />
                </SelectTrigger>
                <SelectPopup>
                  {teknisiOpts.length === 0 ? <SelectItem value="__empty" disabled>Tidak ada teknisi</SelectItem> : teknisiOpts.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.full_name || t.email || t.id.slice(0, 6)}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Informasi Device */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informasi Device</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Merk Handphone *</Label>
                <Input placeholder="Samsung, iPhone, Oppo..." value={merk} onChange={(e) => setMerk(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipe Handphone *</Label>
                <Input placeholder="A54, 14 Pro, Reno 8..." value={tipe} onChange={(e) => setTipe(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>IMEI / SN 1 *</Label>
                <Input placeholder="359..." value={imei1} onChange={(e) => setImei1(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>IMEI / SN 2 (Opsional)</Label>
                <Input placeholder="Opsional" value={imei2} onChange={(e) => setImei2(e.target.value)} />
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Kerusakan (Tag) *</Label>
              <KerusakanTagInput value={kerusakan} onChange={setKerusakan} />
            </div>

            <div className="space-y-1.5">
              <Label>Kelengkapan</Label>
              <KelengkapanSelect value={kelengkapan} onChange={setKelengkapan} />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Password Device *</Label>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setPasswordType("PIN"); setPasswordValue(""); }} className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium ${passwordType === "PIN" ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted border-border"}`}>PIN</button>
                <button type="button" onClick={() => { setPasswordType("POLA"); setPasswordValue(""); }} className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium ${passwordType === "POLA" ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted border-border"}`}>POLA</button>
              </div>
              {passwordType === "PIN" ? (
                <Input placeholder="Masukkan PIN (4-8 digit)" value={passwordValue} onChange={(e) => setPasswordValue(e.target.value.replace(/\D/g, ""))} maxLength={8} inputMode="numeric" />
              ) : (
                <PatternLock value={passwordValue} onChange={setPasswordValue} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Informasi Customer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informasi Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerAutocomplete name={custName} phone={custPhone} address={custAddr} onNameChange={setCustName} onPhoneChange={setCustPhone} onAddressChange={setCustAddr} />
          </CardContent>
        </Card>

        {/* Garansi */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Garansi *</CardTitle>
            <CardDescription>Isi nilai + satuan. Akan override garansi 90 hari default saat status Sudah Diambil.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <Label>Garansi *</Label>
            <GaransiField value={garansiVal} unit={garansiUnit} onValueChange={setGaransiVal} onUnitChange={setGaransiUnit} />
          </CardContent>
        </Card>

        {/* Estimasi Biaya - opsional */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estimasi Biaya <span className="font-normal text-muted-foreground">(Opsional)</span></CardTitle>
            <CardDescription>Perkiraan awal, bisa DP atau lunas nanti. Pembayaran resmi dicatat terpisah (hanya admin/kasir).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <Label>Estimasi (Rp)</Label>
            <Input type="number" min={0} placeholder="Kosongkan jika belum tahu, cth: 350000" value={priceEstimasi} onChange={(e) => { const v = e.target.value; if (v === "") setPriceEstimasi(""); else setPriceEstimasi(Math.max(0, Number(v))); }} />
            <p className="text-[11px] text-muted-foreground">Hanya info awal. Total bayar final dari riwayat pembayaran di detail servis.</p>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>Batal</Button>
          <Button type="submit" disabled={loading}>{loading ? "Menyimpan..." : "Simpan Servis (Masuk)"}</Button>
        </div>
      </form>

      <KondisiAwalDialog open={showKondisi} onOpenChange={setShowKondisi} onSave={handleKondisiSave} onSkip={handleSkip} />
    </>
  );
}
