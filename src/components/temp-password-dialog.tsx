"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CopyButton } from "@/components/arc/copy-button/copy-button";

/** Baris yang disalin sekaligus: email + password (+ PIN jika ada). */
export function buildAccountCredentialsText(input: {
  email: string;
  password: string;
  pin?: string | null;
}) {
  const lines = [`Email: ${input.email}`, `Password: ${input.password}`];
  if (input.pin) lines.push(`PIN: ${input.pin}`);
  return lines.join("\n");
}

/**
 * Password sementara hanya bisa ditampilkan sekali, karena hanya ada di respons
 * server action. Menutup dialog berarti password hilang selamanya dan tidak
 * bisa diambil ulang -maka tombol reset password harus tersedia terpisah.
 */
export function TempPasswordDialog({
  open,
  onOpenChange,
  email,
  password,
  pin,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  email: string;
  password: string;
  pin?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Akun dibuat</DialogTitle>
          <DialogDescription>
            Simpan kredensial ini sekarang. Hanya ditampilkan sekali dan tidak bisa dilihat lagi
            setelah jendela ini ditutup.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3 font-mono text-sm">
          <div className="break-all select-all"><span className="text-muted-foreground">Email: </span>{email}</div>
          <div className="break-all select-all"><span className="text-muted-foreground">Password: </span>{password}</div>
          {pin ? <div className="break-all select-all"><span className="text-muted-foreground">PIN: </span>{pin}</div> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Saat pertama masuk, sistem akan meminta password baru. Password sementara ini
          tidak perlu dimasukkan lagi.
        </p>
        <DialogFooter>
          <CopyButton
            value={buildAccountCredentialsText({ email, password, pin })}
            label="Salin"
            copiedLabel="Tersalin"
            errorLabel="Gagal salin"
          />
          <Button onClick={() => onOpenChange(false)}>Selesai</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
