"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { MIN_PASSWORD_LENGTH, meetsPasswordLength } from "@/lib/auth/password-policy";
import { changeInitialPassword } from "@/app/app/actions/initial-password";

/**
 * Dialog wajib ganti password untuk akun yang dibuat dengan password generated.
 *
 * Sengaja tidak bisa ditutup: tidak ada tombol X, klik backdrop, atau Escape
 * yang menutupnya. User hanya punya dua field - password baru dan konfirmasi -
 * karena password generated yang baru saja dipakai login tidak perlu diulang.
 *
 * Setelah berhasil, sesi diakhiri dan user masuk lagi dengan password baru.
 * Itu memastikan sesi lama (yang lahir dari password sementara) tidak terus
 * dipakai.
 */
export function InitialPasswordDialog({ mustChange }: { mustChange: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!meetsPasswordLength(password)) {
      setError(`Password minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setSaving(true);
    try {
      const result = await changeInitialPassword(password);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success("Password berhasil diganti. Silakan masuk dengan password baru.");
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login?password=updated");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mengganti password.");
    } finally {
      setSaving(false);
    }
  };

  if (!mustChange) return null;

  return (
    <Dialog
      open
      // Kontrol penuh: dialog hanya hilang setelah password berhasil diganti
      // dan sesi diakhiri, bukan karena Escape atau klik di luar.
      onOpenChange={() => {}}
      disablePointerDismissal
    >
      <DialogContent showCloseButton={false} className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Buat password baru</DialogTitle>
          <DialogDescription>
            Buat password sendiri untuk akun ini sebelum melanjutkan. Password
            lama tidak perlu dimasukkan — cukup password baru dan konfirmasinya.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="initial-new-password">Password baru</Label>
            <Input
              id="initial-new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="initial-confirm-password">Konfirmasi password</Label>
            <Input
              id="initial-confirm-password"
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

          <DialogFooter>
            <Button type="submit" className="w-full" disabled={saving} loading={saving}>
              {saving ? "Menyimpan…" : "Simpan dan masuk lagi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
