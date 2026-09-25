"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { completeOnboarding } from "@/app/onboarding/actions";

type Paket = "trial" | "basic" | "pro";

const PAKETS: { id: Paket; title: string; desc: string; price: string; badge?: string }[] = [
  { id: "trial", title: "Trial 14 Hari", desc: "Coba semua fitur", price: "Rp 0" },
  { id: "basic", title: "Basic", desc: "1 toko, 3 user", price: "Rp 199rb /bulan", badge: "Paling Laris" },
  { id: "pro", title: "Pro", desc: "3 cabang, 15 user", price: "Rp 499rb /bulan" },
];

export function OnboardingStepper() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tenantName, setTenantName] = useState("");
  const [branchName, setBranchName] = useState("Cabang Pusat");
  const [alamat, setAlamat] = useState("");
  const [telepon, setTelepon] = useState("");
  const [paket, setPaket] = useState<Paket>("trial");
  const [saving, setSaving] = useState(false);

  // Dark only for onboarding — scoped to this page via .dark on html, fade 300ms via globals.css
  useEffect(() => {
    const html = document.documentElement;
    const hadDark = html.classList.contains("dark");
    html.classList.add("dark");
    return () => {
      if (!hadDark) html.classList.remove("dark");
    };
  }, []);

  const next1 = () => {
    if (!tenantName.trim() || tenantName.trim().length < 3) { toast.error("Nama tenant minimal 3 karakter"); return; }
    setStep(2);
  };
  const next2 = () => {
    if (!branchName.trim()) { toast.error("Nama cabang wajib"); return; }
    setStep(3);
  };
  const submit = async () => {
    setSaving(true);
    try {
      await completeOnboarding({ tenantName, branchName, alamat, telepon, paket });
      toast.success("Tenant dibuat — selamat datang di Cervise");
      router.push("/app");
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat tenant");
    } finally { setSaving(false); }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-bold">Setup Tenant</h1>
          <p className="mt-1 text-sm text-muted-foreground">3 langkah — tenant, cabang, paket</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <span key={s} className={`h-2 w-8 rounded-full transition-colors ${step >= s ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">Langkah {step} dari 3</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }}
          >
            <Card className="shadow-lg">
              {step === 1 && (
                <div className="p-6">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle>Nama Tenant</CardTitle>
                    <CardDescription>Nama organisasi Anda. Akan jadi slug unik.</CardDescription>
                  </CardHeader>
                  <div className="mt-4 grid gap-2">
                    <Label htmlFor="tenant">Nama tenant *</Label>
                    <Input id="tenant" value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Cervise RBM" maxLength={120} autoFocus />
                    <span className="text-xs text-muted-foreground">{tenantName.length} / 120</span>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={next1} disabled={!tenantName.trim()}>Lanjut</Button>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div className="p-6">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle>Buat Cabang</CardTitle>
                    <CardDescription>Cabang pertama — bisa tambah lagi nanti di Pengaturan.</CardDescription>
                  </CardHeader>
                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="branch">Nama cabang *</Label>
                      <Input id="branch" value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="Cabang Pusat" maxLength={50} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="alamat">Alamat (opsional)</Label>
                      <Input id="alamat" value={alamat} onChange={(e) => setAlamat(e.target.value)} placeholder="Jl. Merdeka No.1" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="telepon">Telepon (opsional)</Label>
                      <Input id="telepon" value={telepon} onChange={(e) => setTelepon(e.target.value)} placeholder="0812xxxx" />
                    </div>
                  </div>
                  <div className="mt-6 flex justify-between">
                    <Button variant="ghost" onClick={() => setStep(1)}>Kembali</Button>
                    <Button onClick={next2}>Lanjut</Button>
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="p-6">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle>Pilihan Paket</CardTitle>
                    <CardDescription>Pilih paket atau mulai trial 14 hari gratis.</CardDescription>
                  </CardHeader>
                  <div className="mt-4 grid gap-3">
                    {PAKETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPaket(p.id)}
                        className={`flex items-center justify-between rounded-xl border p-4 text-left transition-colors ${paket === p.id ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/50"}`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p.title}</span>
                            {p.badge && <Badge className="text-[10px]">{p.badge}</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{p.desc}</div>
                          <div className="mt-1 font-mono text-sm font-semibold">{p.price}</div>
                        </div>
                        <span className={`size-5 rounded-full border-2 ${paket === p.id ? "border-primary bg-primary" : "border-muted-foreground/30"}`} />
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 flex justify-between">
                    <Button variant="ghost" onClick={() => setStep(2)} disabled={saving}>Kembali</Button>
                    <Button onClick={submit} disabled={saving}>{saving ? "Memproses…" : "Selesai — Buka Dashboard"}</Button>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
