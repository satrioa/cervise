"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectTrigger, SelectPopup, SelectItem, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import JellyRadio from "@/components/ui/jelly-radio";
import { KerusakanTagInput } from "./kerusakan-tag-input";
import { KelengkapanSelect } from "./kelengkapan-select";
import { GaransiField } from "./garansi-field";
import { CustomerAutocomplete } from "./customer-autocomplete";
import { PatternLock } from "./pattern-lock";
import { KondisiAwalForm } from "./kondisi-awal-form";
import { teknisiLabel } from "@/lib/servis-technisi-label";
import { toast } from "sonner";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { createServis, getServisDetail, getTeknisi, updateKondisiAwal } from "@/app/app/servis/actions";
import { publicTrackingUrl, renderThermalHtml, toPrintData, type PrintContext } from "@/components/print-templates";
import { printReceipt } from "@/lib/printer";
import { useBranchOptional } from "@/lib/branch-context";
import { useTenantOptional } from "@/lib/tenant-context";
import { getReceiptAppearance } from "@/app/app/pengaturan/tampilan/actions";
import { createClient } from "@/lib/supabase/client";
import { playPageTransition } from "@/components/layout/page-transition";
import type { KondisiAwal } from "@/lib/servis-constants";

type ServisFormProps = {
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function ServisForm({ onSuccess, onCancel }: ServisFormProps) {
  const router = useRouter();
  const branchCtx = useBranchOptional();
  const tenantCtx = useTenantOptional();
  const activeTenant = useMemo(
    () => tenantCtx?.tenants.find((t) => t.id === tenantCtx.activeOrgId) ?? null,
    [tenantCtx?.tenants, tenantCtx?.activeOrgId],
  );
  const [receiptAppearance, setReceiptAppearance] = useState<{ logoUrl: string | null; footerText: string | null }>({ logoUrl: null, footerText: null });
  const [branchInfo, setBranchInfo] = useState<{ address: string | null; phone: string | null }>({ address: null, phone: null });
  const branch = branchCtx?.branch;
  useEffect(() => {
    if (!branch?.id || branch.id === "all") {
      setBranchInfo({ address: null, phone: branch?.phone ?? null });
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("branches")
      .select("city, address, phone")
      .eq("id", branch.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const addr = (data?.city as string | null | undefined) ?? (data?.address as string | null | undefined) ?? null;
        setBranchInfo({
          address: addr,
          phone: (data?.phone as string | null | undefined) ?? branch.phone ?? null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [branch?.id, branch?.phone]);
  // Header nota memakai brand organisasi; nama cabang sebagai badge pill.
  const printContext = useMemo<PrintContext>(
    () => ({
      brandName: activeTenant?.name ?? null,
      branchName: branch?.label ?? null,
      address: branchInfo.address,
      phone: branchInfo.phone ?? branch?.phone ?? null,
      tenantSlug: activeTenant?.slug ?? null,
      receiptLogoUrl: receiptAppearance.logoUrl,
      receiptFooterText: receiptAppearance.footerText,
    }),
    [activeTenant?.name, activeTenant?.slug, branch?.label, branch?.phone, branchInfo.address, branchInfo.phone, receiptAppearance.logoUrl, receiptAppearance.footerText],
  );

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
  const [teknisiOpts, setTeknisiOpts] = useState<{ id: string; full_name: string | null; phone: string | null }[]>([]);
  const [garansiVal, setGaransiVal] = useState<number | "">("");
  const [garansiUnit, setGaransiUnit] = useState<"hari" | "bulan" | "tahun">("hari");
  const [priceEstimasi, setPriceEstimasi] = useState<number | "">("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Alur kondisi awal. `kondisiYa` = periksa kondisi setelah servis tersimpan;
  // "Tidak" = simpan lalu langsung selesai. `kondisiOpen` menampilkan formnya.
  const [kondisiYa, setKondisiYa] = useState(true);
  const [kondisiOpen, setKondisiOpen] = useState(false);

  // post-save: form kondisi menggantikan tampilan form, bukan modal di atasnya.
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    getTeknisi().then(setTeknisiOpts).catch(() => {});
  }, []);

  useEffect(() => {
    getReceiptAppearance().then(setReceiptAppearance).catch(() => {});
  }, [tenantCtx?.activeOrgId]);

  const isDirty =
    !!merk || !!tipe || !!imei1 || !!imei2 || kerusakan.length > 0 || kelengkapan.length > 0 || !!passwordValue || !!custName || !!custPhone || !!custAddr || !!teknisiId || garansiVal !== "" || priceEstimasi !== "";

  const { confirmLeave } = useUnsavedGuard(isDirty && !savedId, "Discard changes? Perubahan belum disimpan.");

  /**
   * Selesai satu servis: dialog dashboard memakai `onSuccess` (yang sudah
   * menampilkan toast), sedangkan halaman `/app/servis/baru` perlu toast +
   * kembali ke daftar sendiri.
   */
  const finish = () => {
    if (onSuccess) {
      onSuccess();
      return;
    }
    toast.success("Servis baru tersimpan");
    router.push("/app/servis");
    router.refresh();
  };

  // handle before route leave via click handler will use confirmLeave

  const validate = () => {
    if (!teknisiId) return "Teknisi wajib diisi";
    if (!merk.trim()) return "Merk wajib";
    if (!tipe.trim()) return "Tipe wajib";
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

  /**
   * Nota servis langsung dicetak setelah create. Nomor servis baru ada setelah
   * baris tersimpan, jadi detail diambil ulang lalu dikirim ke printer yang
   * sama dengan tombol cetak di halaman servis. Kegagalan cetak tidak
   * membatalkan servis yang sudah masuk.
   */
  const printNota = async (servisId: string) => {
    try {
      let appearance = receiptAppearance;
      try {
        appearance = await getReceiptAppearance();
        setReceiptAppearance(appearance);
      } catch {}
      const detail = await getServisDetail(servisId);
      const data = toPrintData(
        detail,
        { ...printContext, receiptLogoUrl: appearance.logoUrl, receiptFooterText: appearance.footerText },
        detail,
      );
      const result = await printReceipt({
        kind: "service",
        html: renderThermalHtml(data),
        trackingUrl: publicTrackingUrl(data.service.tenantSlug, data.service.trackingCode),
        service: data,
      });
      if (!result.fallback) toast.success("Nota servis dikirim ke printer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mencetak nota servis");
    }
  };

  /** Memvalidasi lalu menyimpan servis. Satu jalur untuk dua pemicu. */
  const saveServis = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await createServis({
        teknisi_id: teknisiId,
        merk: merk.trim(),
        tipe: tipe.trim(),
        imei1: imei1.trim() || null,
        imei2: imei2.trim() || null,
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
      playPageTransition();
      // Cetak otomatis setelah servis tersimpan; jangan tunggu layar kondisi.
      void printNota(res.id);
      return res;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Sudah tersimpan (mis. lewat Check Kondisi lalu switch kondisi dimatikan):
    // jangan buat servis kedua, langsung selesaikan.
    if (savedId) {
      finish();
      return;
    }
    const res = await saveServis();
    if (!res) return;
    setSavedId(res.id);
    // "Ya" membuka langkah kondisi; "Tidak" langsung selesai.
    if (kondisiYa) setKondisiOpen(true);
    else finish();
  };

  const handleKondisiSave = async (data: KondisiAwal) => {
    if (!savedId) return;
    await updateKondisiAwal(savedId, data);
    playPageTransition();
    finish();
  };
  const handleSkip = () => {
    finish();
  };

  const handleCancel = () => {
    if (!confirmLeave()) return;
    if (onCancel) onCancel();
    else if (onSuccess) onSuccess();
    else router.push("/app/servis");
  };

  return (
    <>
      {/*
        Setelah servis tersimpan dan langkah kondisi dibuka, form kondisi
        MEGANTIKAN tampilan form servis -- bukan modal di atasnya. Alasannya
        modalnya tumpang tindih dengan form yang masih kelihatan di belakang,
        dan form itu sudah tidak bisa diedit tanpa menggantungkan pengguna di
        dua tempat. Data form sudah tersimpan, jadi tidak ada yang hilang.
      */}
      {kondisiOpen && savedId ? (
        <KondisiAwalForm onSave={handleKondisiSave} onSkip={handleSkip} />
      ) : (
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-0 py-6">
        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

        {/* Teknisi - wajib */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Teknisi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label>Teknisi *</Label>
              <Select value={teknisiId} onValueChange={(v) => setTeknisiId(v as string)}>
                <SelectTrigger>
                  {/* Children WAJIB diisi eksplisit. `Select.Value` milik base-ui
                     menampilkan value mentah kalau tidak diberi children --
                     jadi tanpa baris ini trigger menampilkan UUID teknisi,
                     bukan namanya. Select lain di repo ini sudah melakukan
                     hal yang sama. */}
                  <SelectValue placeholder="Pilih teknisi">
                    {teknisiLabel(teknisiOpts.find((t) => t.id === teknisiId))}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup matchTriggerWidth>
                  {teknisiOpts.length === 0 ? <SelectItem value="__empty" disabled>Tidak ada teknisi</SelectItem> : teknisiOpts.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{teknisiLabel(t)}</SelectItem>
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
                <Label>IMEI / SN 1</Label>
                <Input placeholder="Opsional" value={imei1} onChange={(e) => setImei1(e.target.value)} />
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
          </CardHeader>
          <CardContent className="space-y-1.5">
            <Label>Estimasi (Rp)</Label>
            <Input type="number" min={0} placeholder="Kosongkan jika belum tahu, cth: 350000" value={priceEstimasi} onChange={(e) => { const v = e.target.value; if (v === "") setPriceEstimasi(""); else setPriceEstimasi(Math.max(0, Number(v))); }} />
            <p className="text-[11px] text-muted-foreground">Hanya info awal. Total bayar final dari riwayat pembayaran di detail servis.</p>
          </CardContent>
        </Card>

        {/* Kondisi awal — dipisah dari Estimasi biaya. "Ya" membuka form
            pemeriksaan setelah servis tersimpan; "Tidak" langsung selesai. */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kondisi Awal</CardTitle>
            <CardDescription>Periksa kondisi perangkat sebelum dikerjakan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <JellyRadio
              items={[{ value: "ya", label: "Ya" }, { value: "tidak", label: "Tidak" }]}
              value={kondisiYa ? "ya" : "tidak"}
              onChange={(v: string) => setKondisiYa(v === "ya")}
              chipColor="#e4e4e7"
              activeColor="#18181b"
              textColor="#18181b"
              activeTextColor="#f5f5f5"
              invertDark
              size="md"
              gap={8}
              radius={18}
              ariaLabel="Check kondisi awal"
            />
            <p className="text-[11px] text-muted-foreground">
              {kondisiYa ? "Form pemeriksaan muncul setelah servis disimpan." : "Servis langsung selesai tanpa pemeriksaan kondisi."}
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>Batal</Button>
          <Button type="submit" disabled={loading}>{loading ? "Menyimpan..." : "Simpan Servis (Masuk)"}</Button>
        </div>
      </form>
      )}
    </>
  );
}
