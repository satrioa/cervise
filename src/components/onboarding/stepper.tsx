"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import PredictiveArc from "@/components/originkit/ui/predictive-arc-custom-style";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FloatingLabelInput } from "@/components/interior/floating-label";
import { InlineValidation, useInlineValidation } from "@/components/interior/inline-validation";
import { validatePhone } from "@/lib/phone";
import {
  BRANCH_NAME_MAX,
  TENANT_NAME_MAX,
  isTenantNameSubmittable,
  validateRequiredTenantName,
} from "@/lib/onboarding/validation";
import { completeOnboarding } from "@/app/onboarding/actions";

/**
 * validatePhone mengembalikan union, sedangkan useInlineValidation dan
 * tombol Lanjut sama-sama butuh bentuk "pesan atau null". Konversi di satu
 * tempat supaya aturan nomornya tetap milik src/lib/phone.ts, bukan punya
 * versi kedua di sini.
 */
function validateTelepon(value: string): string | null {
  const result = validatePhone(value);
  return result.ok ? null : result.error;
}

const TENANT_HINT = "Dipakai untuk URL tenant, jadi huruf dan angka saja.";

export function OnboardingStepper() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tenantName, setTenantName] = useState("");
  const [branchName, setBranchName] = useState("Cabang Pusat");
  const [alamat, setAlamat] = useState("");
  const [telepon, setTelepon] = useState("");
  const [saving, setSaving] = useState(false);
  const tenantInputRef = useRef<HTMLInputElement>(null);

  // Step 1 hanya punya satu field, jadi fokus otomatis-nya dipindah ke sini
  // karena FloatingLabelInput tidak punya prop autoFocus. AnimatePresence
  // memakai key={step}, jadi konten step 1 di-mount ulang setiap kali
  // step 1 tampil - sama seperti perilaku autoFocus sebelumnya.
  useEffect(() => {
    if (step === 1) tenantInputRef.current?.focus();
  }, [step]);

  // Error baru muncul setelah field ditinggalkan (touched), bukan saat mengetik.
  // Gate tombol di bawah tetap memakai validasinya secara langsung, supaya
  // tombol tidak pernah menyala untuk nilai yang server tolak.
  const tenantField = useInlineValidation({
    value: tenantName,
    validate: validateRequiredTenantName,
  });
  const tenantReady = isTenantNameSubmittable(tenantName);
  const teleponValid = validatePhone(telepon).ok;
  const branchReady = branchName.trim() !== "";

  const next1 = () => {
    if (!tenantReady) {
      // Field baru saja diklik, jadi touched masih false dan pesan inline belum
      // tampil. Toast adalah satu-satunya cara memberitahu di sini.
      toast.error("Nama tenant minimal 3 karakter");
      return;
    }
    setStep(2);
  };

  const submit = async () => {
    setSaving(true);
    try {
      await completeOnboarding({ tenantName, branchName, alamat, telepon });
      toast.success("Tenant dibuat dengan trial 14 hari");
      router.push("/app");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat tenant");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative isolate flex min-h-svh items-center justify-center overflow-hidden bg-white px-4 py-10 text-slate-950">
      <div aria-hidden className="pointer-events-auto absolute inset-0 z-0 overflow-hidden">
        <PredictiveArc
          background="#FFFFFF"
          baseColor="#2700FF"
          accentColor="#98E4FF"
          highlight="#002DA0"
          density={245}
          dotSize={103}
          speed={reduceMotion ? 0 : 100}
          arch={{ peak: 100, archHeight: 70, thickness: 300, falloff: 600 }}
          pointer={{ enabled: !reduceMotion, strength: 22 }}
          style={{ minWidth: 0, minHeight: 0, width: "100%", height: "100%", touchAction: "auto" }}
        />
      </div>
      <div className="relative z-10 w-full max-w-xl">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-bold text-slate-950">Setup Tenant</h1>
          <div className="mt-4 flex items-center justify-center gap-2">
            {[1, 2, 3].map((item) => <span key={item} className={`h-2 w-8 rounded-full transition-colors ${step >= item ? "bg-blue-600" : "bg-slate-200"}`} />)}
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }}
          >
            <Card className="border-0 bg-transparent p-0 shadow-none before:hidden">
              {step === 1 ? (
              <div className="p-6">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-slate-950">Nama Tenant</CardTitle>
                  <CardDescription className="text-slate-600">Nama organisasi Anda. Akan jadi slug unik.</CardDescription>
                </CardHeader>
                <div className="mt-4">
                  <FloatingLabelInput
                    id="tenant"
                    label="Nama tenant"
                    value={tenantName}
                    onChange={setTenantName}
                    onBlur={tenantField.commit}
                    invalid={tenantField.status === "invalid"}
                    hint={tenantField.error ?? TENANT_HINT}
                    maxLength={TENANT_NAME_MAX}
                    required
                    inputRef={tenantInputRef}
                  />
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={next1} disabled={!tenantReady}>Lanjut</Button>
                </div>
              </div>
            ) : null}
              {step === 2 ? (
              <div className="p-6">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-slate-950">Buat Cabang</CardTitle>
                  <CardDescription className="text-slate-600">Cabang pertama dibuat otomatis dan dapat ditambah nanti sesuai package.</CardDescription>
                </CardHeader>
                <div className="mt-4 grid gap-3">
                  <FloatingLabelInput
                    id="branch"
                    label="Nama cabang"
                    value={branchName}
                    onChange={setBranchName}
                    maxLength={BRANCH_NAME_MAX}
                    hint="Cabang pertama, misalnya Cabang Pusat."
                    required
                  />
                  <FloatingLabelInput
                    id="alamat"
                    label="Alamat"
                    value={alamat}
                    onChange={setAlamat}
                    hint="Opsional. Dicetak di header struk."
                  />
                  <InlineValidation
                    id="telepon"
                    label="WhatsApp"
                    value={telepon}
                    onChange={setTelepon}
                    validate={validateTelepon}
                    hint="Opsional. Untuk notifikasi status ke customer."
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="0812xxxx"
                  />
                </div>
                <div className="mt-6 flex justify-between">
                  <Button variant="ghost" className="text-slate-700 hover:bg-slate-100 hover:text-slate-950" onClick={() => setStep(1)}>Kembali</Button>
                  <Button onClick={() => setStep(3)} disabled={!branchReady || !teleponValid}>Lanjut</Button>
                </div>
              </div>
            ) : null}
              {step === 3 ? <div className="p-6"><CardHeader className="px-0 pt-0"><CardTitle className="text-slate-950">Tenant siap dicoba</CardTitle><CardDescription className="text-slate-600">Setiap tenant baru mendapatkan trial gratis 14 hari sebelum memilih paket paid.</CardDescription></CardHeader><div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="font-medium text-slate-950">Trial 14 hari</div><div className="mt-1 text-sm text-slate-600">1 branch pusat aktif. Pilih paket paid setelah selesai trial melalui Billing; admin akan mengaktifkan setelah pembayaran WhatsApp diverifikasi.</div></div><div className="mt-6 flex justify-between"><Button variant="ghost" className="text-slate-700 hover:bg-slate-100 hover:text-slate-950" onClick={() => setStep(2)} disabled={saving}>Kembali</Button><Button onClick={submit} loading={saving}>{saving ? "Memproses…" : "Selesai — Buka Dashboard"}</Button></div></div> : null}
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
