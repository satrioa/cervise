"use client";

import { type FormEvent, useMemo, useState } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type Strength = "empty" | "weak" | "ok" | "strong";
function computeStrength(password: string): Strength {
  if (!password) return "empty";
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^\w\s]/.test(password);
  if (password.length >= 12 || (password.length >= 8 && hasDigit && hasSymbol)) return "strong";
  if (password.length >= 8 && (hasDigit || hasSymbol)) return "ok";
  return "weak";
}
const STRENGTH_META: Record<Strength, { label: string; segments: number; color: string; text: string }> = {
  empty: { label: "", segments: 0, color: "bg-border", text: "text-muted-foreground" },
  weak: { label: "Lemah", segments: 1, color: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  ok: { label: "Cukup", segments: 2, color: "bg-sky-500", text: "text-sky-600 dark:text-sky-400" },
  strong: { label: "Kuat", segments: 3, color: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
};

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [terms, setTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const strength = useMemo(() => computeStrength(password), [password]);
  const meta = STRENGTH_META[strength];
  const canSubmit = terms && name.trim() !== "" && email.trim() !== "" && password !== "";

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (error) throw error;
      toast.success("Akun dibuat — cek email untuk verifikasi");
      router.push("/login");
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal daftar");
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
                  <InputGroupInput id="signup-password" type={reveal ? "text" : "password"} required placeholder="Minimal 8 karakter" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} nativeInput />
                  <InputGroupAddon align="inline-end">
                    <button type="button" onClick={() => setReveal((v) => !v)} aria-label={reveal ? "Hide" : "Show"} className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground">
                      {reveal ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                    </button>
                  </InputGroupAddon>
                </InputGroup>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex flex-1 gap-1">{[0, 1, 2].map((i) => (<div key={i} className={`h-1.5 flex-1 rounded-full ${i < meta.segments ? meta.color : "bg-border"}`} />))}</div>
                  <span className={`min-w-[3.5rem] text-right font-mono text-[10px] uppercase tracking-[0.2em] ${meta.text}`}>{meta.label}</span>
                </div>
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
