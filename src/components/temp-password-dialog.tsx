"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

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
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  email: string;
  password: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success("Password disalin");
    } catch {
      toast.error("Tidak bisa menyalin otomatis. Pilih dan salin manual.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Akun dibuat</DialogTitle>
          <DialogDescription>
            {email} — simpan password ini sekarang. Hanya ditampilkan sekali dan tidak bisa
            dilihat lagi setelah jendela ini ditutup.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/30 p-3 font-mono text-sm break-all select-all">
          {password}
        </div>
        <p className="text-xs text-muted-foreground">
          Setelah masuk, segera ganti password di halaman Profil.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            {copied ? "Tersalin" : "Salin"}
          </Button>
          <Button onClick={() => onOpenChange(false)}>Selesai</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
