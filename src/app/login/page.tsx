"use client";

import { type FormEvent, useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardPanel } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background px-4 py-12 text-foreground">
      <PageBackdrop />
      <div className="relative w-full max-w-sm">
        <Card className="p-7">
          <CardHeader className="flex flex-col items-center gap-4 p-0 text-center">
            <BrandMark />
            <div className="flex flex-col gap-1.5">
              <h1 className="font-heading text-2xl tracking-tight">Masuk ke Cervise</h1>
              <p className="text-muted-foreground text-sm">Servis HP · 1 user 1 cabang</p>
            </div>
          </CardHeader>
          <CardPanel className="mt-6 flex flex-col gap-5 p-0">
            <SignInForm />
            <FooterLinks />
          </CardPanel>
        </Card>
      </div>
    </div>
  );
}

function PageBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        background: [
          "radial-gradient(50% 40% at 0% 0%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 70%)",
          "radial-gradient(55% 45% at 100% 100%, color-mix(in oklch, var(--foreground) 8%, transparent), transparent 70%)",
        ].join(", "),
      }}
    />
  );
}

function BrandMark() {
  return (
    <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">C</div>
  );
}

function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      toast.success("Berhasil masuk");
      router.push("/app");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal masuk");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="centered-email">Email</FieldLabel>
        <Input id="centered-email" type="email" required placeholder="master@cervise.id" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} nativeInput />
      </Field>
      <Field>
        <FieldLabel htmlFor="centered-password">Password</FieldLabel>
        <InputGroup>
          <InputGroupInput id="centered-password" type={reveal ? "text" : "password"} required placeholder="••••••••" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} nativeInput />
          <InputGroupAddon align="inline-end">
            <button type="button" onClick={() => setReveal((v) => !v)} aria-label={reveal ? "Hide password" : "Show password"} className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {reveal ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">Masuk</Button>
    </form>
  );
}

function FooterLinks() {
  return (
    <div className="flex items-baseline justify-between gap-4 text-xs">
      <Link href="#" className="text-muted-foreground hover:text-foreground hover:underline">Lupa password?</Link>
      <p className="text-muted-foreground">
        Belum punya akun? <Link href="/signup" className="text-foreground hover:underline">Daftar</Link>
      </p>
    </div>
  );
}
