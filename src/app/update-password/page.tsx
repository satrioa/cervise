import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "./update-password-form";

/**
 * Landing page untuk link reset password.
 *
 * Recovery link Supabase datang dalam dua bentuk:
 * - `?code=...` (PKCE) - ditukar di server supaya cookie session langsung
 *   tertulis, lalu form tinggal memanggil updateUser.
 * - `#access_token=...&type=recovery` (implicit) - fragment tidak pernah sampai
 *   ke server, jadi browser client yang memakainya. Form mengecek session-nya
 *   sendiri sebelum menampilkan input.
 *
 * Kalau tidak ada keduanya, jangan tampilkan form: user akan mengetik
 * password baru ke form yang tidak punya session dan mendapat error yang
 * membingungkan.
 */
export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const { code, error } = await searchParams;

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error)}`);
  }

  let exchangeFailed = false;
  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    exchangeFailed = Boolean(exchangeError);
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-heading text-2xl font-semibold">Password baru</h1>
          <p className="text-sm text-muted-foreground">
            Masukkan password baru untuk akun Cervise Anda.
          </p>
        </div>
        <UpdatePasswordForm exchangeFailed={exchangeFailed} />
      </div>
    </div>
  );
}
