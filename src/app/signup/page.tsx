"use client";

import { type FormEvent, useState } from "react";
import { CheckIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PasswordStrength, type PasswordRule } from "@/components/interior/password-strength";
import { meetsPasswordLength, MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import { toast } from "sonner";
import { signupAction } from "./actions";

/**
 * Aturan dan label didefinisikan di luar komponen, bukan inline di JSX.
 * usePasswordStrength menghitung state-nya di dalam useMemo dengan `rules` dan
 * `labels` sebagai dependensi. Array yang dibuat inline akan mendapat identitas
 * baru tiap render, jadi memo tidak pernah kena cache dan animasi meter
 * berkedip ulang setiap kali user mengetik.
 */
const SIGNUP_RULES: readonly PasswordRule[] = [
  { id: "length", label: `Minimal ${MIN_PASSWORD_LENGTH} karakter`, test: (v) => meetsPasswordLength(v) },
  { id: "case", label: "Huruf besar dan huruf kecil", test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { id: "digit", label: "Mengandung angka", test: (v) => /\d/.test(v) },
  { id: "symbol", label: "Mengandung simbol", test: (v) => /[!-/:-@[-`{-~]/.test(v) },
];

/**
 * Lima label untuk skor 0..4 (jumlah aturan = 4, jadi indeks tertinggi adalah 4).
 * Urutannya penting: komponen memakai labels[min(score, labels.length - 1)].
 */
const STRENGTH_LABELS = ["Kosong", "Lemah", "Cukup", "Kuat", "Sangat kuat"] as const;

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [terms, setTerms] = useState(false);
  const [pending, setPending] = useState(false);

  // Gate memakai aturan yang sama dengan server (minimal 8 karakter), bukan
  // "semua aturan terpenuhi". Aturan sisanya shown purely sebagai saran -
  // kalau tombol ikut terkunci sampai semua terpenuhi, form ini akan
  //amins Advertises a policy that signupAction tidak punya.
  const canSubmit =
    terms && name.trim() !== "" && email.trim() !== "" && meetsPasswordLength(password);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    try {
      await signupAction({ name: name.trim(), email: email.trim(), password });
      toast.success("Akun dibuat — langsung Masuk");
      router.push("/login");
    } catch (err: unknown) {
      const msg = String((err as Error)?.message ?? "Gagal daftar");
      toast.error(msg);
    } finally { setPending(false); }
  };

  return (
    <div className="relative min-h-svh overflow-hidden bg-background text-foreground">
      <PageBackdrop />
      <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-12">
        <BenefitPills />
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <div className="mb-3 flex justify-center"><div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">C</div></div>
            <CardTitle className="font-heading text-2xl tracking-tight">Buat akun Cervise</CardTitle>
            <CardDescription>Coba gratis 14 hari — 1 user 1 cabang</CardDescription>
          </CardHeader>
          <CardPanel className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Daftar dengan email</span>
              <Separator className="flex-1" />
            </div>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="signup-name">Nama lengkap</FieldLabel>
                <Input id="signup-name" type="text" required placeholder="Budi Servis" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} nativeInput />
              </Field>
              <Field>
                <FieldLabel htmlFor="signup-email">Email</FieldLabel>
                <Input id="signup-email" type="email" required placeholder="budi@cervise.id" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} nativeInput />
              </Field>
              <Field>
                <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                <InputGroup>
                  <InputGroupInput id="signup-password" type={reveal ? "text" : "password"} required placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} nativeInput />
                  <InputGroupAddon align="inline-end">
                    <button type="button" onClick={() => setReveal((v) => !v)} aria-label={reveal ? "Sembunyikan password" : "Tampilkan password"} className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground">
                      {reveal ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                    </button>
                  </InputGroupAddon>
                </InputGroup>
                {password ? (
                  <div className="mt-3">
                    <PasswordStrength
                      value={password}
                      rules={SIGNUP_RULES}
                      labels={STRENGTH_LABELS}
                      meterLabel="Kekuatan password"
                      guessableLabel="Pola yang sering ditebak"
                    />
                    <p className="mt-3 text-xs text-muted-foreground">
                      Syarat wajib: minimal {MIN_PASSWORD_LENGTH} karakter. Sisanya membuat password jauh lebih
                      sulit ditebak.
                    </p>
                  </div>
                ) : null}
              </Field>
              <div className="flex items-start gap-2.5">
                <Checkbox id="signup-terms" checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
                <Label htmlFor="signup-terms" className="text-muted-foreground text-sm leading-snug">
                  Saya setuju <a href="#" className="text-foreground underline-offset-4 hover:underline">Syarat</a> dan <a href="#" className="text-foreground underline-offset-4 hover:underline">Privasi</a>
                </Label>
              </div>
              <Button type="submit" size="lg" loading={pending} disabled={!canSubmit} className="mt-1 w-full">Buat akun</Button>
            </form>
          </CardPanel>
          <CardFooter className="justify-center">
            <p className="text-muted-foreground text-sm">Sudah punya akun? <Link href="/login" className="text-foreground underline-offset-4 hover:underline">Masuk</Link></p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function BenefitPills() {
  const items = ["Gratis 14 hari", "Tanpa kartu kredit", "Batal kapan saja"];
  return (
    <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
      {items.map((label) => (
        <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] backdrop-blur-sm">
          <CheckIcon className="size-3 text-emerald-500" />{label}
        </span>
      ))}
    </div>
  );
}

function PageBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute top-[-10%] left-[-10%] size-[40rem] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute right-[-10%] bottom-[-10%] size-[40rem] rounded-full bg-accent/15 blur-3xl" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--color-foreground) 4%, transparent), transparent 70%)" }} />
    </div>
  );
}
