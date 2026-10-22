"use client";

import { type FormEvent, useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardPanel } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { createClient } from "@/lib/supabase/client";
import { getPostLoginDestination } from "./actions";
import { toast } from "sonner";

export default function LoginPage() {
  // Params ini dipakai /update-password setelah password berhasil diganti, dan
  // oleh middleware saat akses ditolak. Tanpa ini user melihat form login tanpa
  // penjelasan kenapa mereka tiba-tiba harus login lagi.
  const notice = usePasswordNotice();

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background px-4 py-12 text-foreground">
      <PageBackdrop />
      <div className="relative w-full max-w-sm">
        <Card className="p-7">
          <CardHeader className="flex flex-col items-center gap-4 p-0 text-center">
            <BrandMark />
            {/* Subtitle dihapus, jadi wrapper flex-col yang tadinya
                membungkus judul + subtitle sudah tidak ada gunanya. */}
            <h1 className="font-heading text-2xl tracking-tight">Masuk ke Cervise</h1>
          </CardHeader>
          {notice ? (
            <p
              role="status"
              className={
                notice.kind === "success"
                  ? "mt-5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"
                  : "mt-5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              }
            >
              {notice.message}
            </p>
          ) : null}
          <CardPanel className="mt-6 flex flex-col gap-5 p-0">
            <SignInForm />
            <FooterLinks />
          </CardPanel>
        </Card>
      </div>
    </div>
  );
}

/**
 * Pesan yang muncul di atas form login.
 *
 * Dipisah dari komponen supaya bisa diuji tanpa merender React: yang perlu
 * dijaga adalah pemetaan kode error ke kalimatnya, dan itu murni.
 *
 * `tenant-access-denied` sengaja punya kalimat sendiri. Tanpa ini, tenant yang
 * trial-nya habis melihat layar login yang sama seperti biasa - tidak ada
 * penjelasan kenapa mereka dikeluarkan, dan tidak ada arah ke jalan keluar.
 */
export function loginNoticeFromParams(params: URLSearchParams): { kind: "success" | "error"; message: string } | null {
  const password = params.get("password");
  if (password === "updated") {
    return { kind: "success", message: "Password berhasil diganti. Silakan masuk." };
  }

  const error = params.get("error");
  if (error === "access_denied") {
    return { kind: "error", message: "Link reset password tidak valid atau sudah kedaluwarsa." };
  }
  if (error === "tenant-access-denied") {
    return {
      kind: "error",
      message:
        "Akses ditolak: akun, cabang, atau langganan Anda tidak aktif. Hubungi pemilik toko atau platform owner untuk mengaktifkannya kembali.",
    };
  }
  if (error === "tenant-owner-inactive") {
    return {
      kind: "error",
      message:
        "Tidak bisa masuk. Langganan tenant Anda sudah berakhir atau dinonaktifkan. Sebagai pemilik, hubungi platform owner untuk memperpanjang langganan.",
    };
  }
  if (error === "tenant-inactive") {
    return {
      kind: "error",
      message:
        "Tidak bisa masuk. Tenant Anda sedang tidak aktif. Hubungi pemilik toko atau admin untuk memperpanjang langganan.",
    };
  }
  if (error === "account-inactive") {
    return {
      kind: "error",
      message: "Tidak bisa masuk. Akun Anda dinonaktifkan. Hubungi admin.",
    };
  }
  if (error === "tenant-access-check-failed") {
    return {
      kind: "error",
      message: "Pemeriksaan akses gagal sementara. Coba beberapa saat lagi, atau hubungi platform owner bila terus gagal.",
    };
  }
  return null;
}

function usePasswordNotice() {
  const searchParams = useSearchParams();
  return loginNoticeFromParams(searchParams);
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
      const clientSavedOrganizationId = window.localStorage.getItem("cervise_org");
      const result = await getPostLoginDestination(clientSavedOrganizationId);
      if (result.kind === "denied") {
        toast.error("Tidak bisa masuk");
        router.replace(`/login?error=${result.reason}`);
        router.refresh();
        return;
      }
      toast.success("Berhasil masuk");
      router.push(result.destination);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal masuk");
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
