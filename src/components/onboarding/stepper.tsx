"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import PredictiveArc from "@/components/originkit/ui/predictive-arc-custom-style";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { completeOnboarding } from "@/app/onboarding/actions";

export function OnboardingStepper() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tenantName, setTenantName] = useState("");
  const [branchName, setBranchName] = useState("Cabang Pusat");
  const [alamat, setAlamat] = useState("");
  const [telepon, setTelepon] = useState("");
  const [saving, setSaving] = useState(false);

  const next1 = () => {
    if (tenantName.trim().length < 3) {
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
              {step === 1 ? <div className="p-6"><CardHeader className="px-0 pt-0"><CardTitle className="text-slate-950">Nama Tenant</CardTitle><CardDescription className="text-slate-600">Nama organisasi Anda. Akan jadi slug unik.</CardDescription></CardHeader><div className="mt-4 grid gap-2"><Label htmlFor="tenant" className="text-slate-700">Nama tenant *</Label><Input id="tenant" className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 [&_input]:text-slate-950 [&_input]:placeholder:text-slate-400" value={tenantName} onChange={(event) => setTenantName(event.target.value)} placeholder="Cervise RBM" maxLength={120} autoFocus /><span className="text-xs text-slate-500">{tenantName.length} / 120</span></div><div className="mt-6 flex justify-end"><Button onClick={next1} disabled={!tenantName.trim()}>Lanjut</Button></div></div> : null}
              {step === 2 ? <div className="p-6"><CardHeader className="px-0 pt-0"><CardTitle className="text-slate-950">Buat Cabang</CardTitle><CardDescription className="text-slate-600">Cabang pertama dibuat otomatis dan dapat ditambah nanti sesuai package.</CardDescription></CardHeader><div className="mt-4 grid gap-4"><div className="grid gap-2"><Label htmlFor="branch" className="text-slate-700">Nama cabang *</Label><Input id="branch" className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 [&_input]:text-slate-950 [&_input]:placeholder:text-slate-400" value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="Cabang Pusat" maxLength={50} /></div><div className="grid gap-2"><Label htmlFor="alamat" className="text-slate-700">Alamat (opsional)</Label><Input id="alamat" className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 [&_input]:text-slate-950 [&_input]:placeholder:text-slate-400" value={alamat} onChange={(event) => setAlamat(event.target.value)} placeholder="Jl. Merdeka No.1" /></div><div className="grid gap-2"><Label htmlFor="telepon" className="text-slate-700">WhatsApp (opsional)</Label><Input id="telepon" className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 [&_input]:text-slate-950 [&_input]:placeholder:text-slate-400" value={telepon} onChange={(event) => setTelepon(event.target.value)} placeholder="0812xxxx" inputMode="tel" /></div></div><div className="mt-6 flex justify-between"><Button variant="ghost" className="text-slate-700 hover:bg-slate-100 hover:text-slate-950" onClick={() => setStep(1)}>Kembali</Button><Button onClick={() => setStep(3)} disabled={!branchName.trim()}>Lanjut</Button></div></div> : null}
              {step === 3 ? <div className="p-6"><CardHeader className="px-0 pt-0"><CardTitle className="text-slate-950">Tenant siap dicoba</CardTitle><CardDescription className="text-slate-600">Setiap tenant baru mendapatkan trial gratis 14 hari sebelum memilih paket paid.</CardDescription></CardHeader><div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="font-medium text-slate-950">Trial 14 hari</div><div className="mt-1 text-sm text-slate-600">1 branch pusat aktif. Pilih paket paid setelah selesai trial melalui Billing; admin akan mengaktifkan setelah pembayaran WhatsApp diverifikasi.</div></div><div className="mt-6 flex justify-between"><Button variant="ghost" className="text-slate-700 hover:bg-slate-100 hover:text-slate-950" onClick={() => setStep(2)} disabled={saving}>Kembali</Button><Button onClick={submit} loading={saving}>{saving ? "Memproses…" : "Selesai — Buka Dashboard"}</Button></div></div> : null}
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
