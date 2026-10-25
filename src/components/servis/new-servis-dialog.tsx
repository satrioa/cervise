"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ServisForm } from "@/components/servis/servis-form";

/**
 * "Servis baru" dari dashboard.
 *
 * Dulu kartu bento menautkan ke `/app/servis/baru` — satu navigasi penuh hanya
 * untuk formulir yang isinya tidak bergantung pada halaman. Dialog ini memakai
 * `ServisForm` yang sama dengan halaman itu, jadi tidak ada form kedua yang
 * harus ikut diperbaiki setiap kali field servis berubah.
 *
 * Route `/app/servis/baru` tetap ada: bottom-nav `AppShell` memakainya sebagai
 * tombol "Tambah".
 */
export function NewServisDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /**
   * Dipanggil setelah servis tersimpan.
   *
   * Dashboard mengambil antreannya lewat server action dari komponen klien,
   * jadi `router.refresh()` saja tidak menyegarkan daftarnya — komponen tidak
   * di-mount ulang dan state kliennya dipertahankan. Pemanggil mengoper
   * `reload()` miliknya sendiri di sini.
   */
  onCreated?: () => void;
}) {
  const handleSuccess = useCallback(() => {
    onOpenChange(false);
    toast.success("Servis baru tersimpan");
    onCreated?.();
  }, [onCreated, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tambah Servis</DialogTitle>
          <DialogDescription>
            Catat servis gadget baru tanpa meninggalkan dashboard.
          </DialogDescription>
        </DialogHeader>
        <ServisForm onSuccess={handleSuccess} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
