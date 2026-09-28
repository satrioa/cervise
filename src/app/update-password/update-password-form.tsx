"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_LENGTH = 8;

type State = "checking" | "ready" | "invalid";

export function UpdatePasswordForm({ exchangeFailed }: { exchangeFailed: boolean }) {
  const router = useRouter();
  // Dibuat sekali saat render pertama, bukan di dalam effect: client ini stateless
  // dan hanya membaca cookie browser, jadi tidak perlu state.
  const [supabase] = useState(() => createClient());
  const [state, setState] = useState<State>(exchangeFailed ? "invalid" : "checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fragment #access_token=... tidak pernah sampai ke server, jadi session dari
  // recovery link implicit flow baru ada di browser. supabase-js memprosesnya
  // saat client diinisialisasi; kita tunggu session itu sebelum memutuskan
  // apakah form boleh tampil.
  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setState(data.session ? "ready" : "invalid");
      })
      .catch(() => {
        if (!cancelled) setState("invalid");
      });

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_LENGTH) {
      setError(`Password minimal ${MIN_LENGTH} karakter.`);
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    // Session recovery shouldn't outlive the password change - sign out so the
    // user logs back in with the new password instead of staying on a
    // recovery-derived session.
    await supabase.auth.signOut();
    router.replace("/login?password=updated");
    router.refresh();
  }

  if (state === "checking") {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        Memvalidasi link reset password…
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="space-y-4 rounded-xl border bg-card p-6 text-center">
        <p className="font-medium">Link reset password tidak valid</p>
        <p className="text-sm text-muted-foreground">
          Link sudah dipakai atau kedaluwarsa. Minta link baru dari halaman pengaturan
          profil, atau hubungi admin.
        </p>
        <Button variant="outline" size="sm" render={<Link href="/login" />}>
          Kembali ke login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-6">
      <div className="space-y-2">
        <Label htmlFor="new-password">Password baru</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={`Minimal ${MIN_LENGTH} karakter`}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Ulangi password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Menyimpan…" : "Simpan password baru"}
      </Button>
    </form>
  );
}
