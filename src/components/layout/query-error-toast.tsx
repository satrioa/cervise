"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * Pesan untuk param `?error=` yang dikirim middleware dan helper redirect.
 *
 * Sebelumnya tidak ada yang membacanya. `platform-admin-required` dan
 * `tenant-access-denied` dilempar ke halaman login tanpa penjelasan apa pun,
 * sehingga penolakan akses terasa seperti sesi yang hilang - user yang
 * sebenarnya masih login disuruh login lagi tanpa tahu kenapa.
 *
 * Dipasang satu kali di layout /app. Param dibaca satu kali lalu dihapus dari
 * URL, supaya me-refresh tidak memunculkan toast yang sama berulang-ulang.
 */
const MESSAGES: Record<string, string> = {
  "platform-admin-required":
    "Halaman itu hanya untuk staff Cervise. Akun kamu tetap bisa dipakai seperti biasa di tenant kamu.",
  "tenant-access-denied": "Akses ke tenant ini ditolak. Hubungi admin tenant kalau ini tidak sesuai.",
  "tenant-access-check-failed": "Gagal memverifikasi akses tenant. Muat ulang sekali lagi.",
  "subscription-blocked": "Langganan tenant ini sedang tidak aktif.",
};

export function QueryErrorToast() {
  const searchParams = useSearchParams();
  const code = searchParams.get("error");
  const message = code ? MESSAGES[code] : undefined;

  useEffect(() => {
    if (!code || !message) return;

    toast.error(message);

    // Bersihkan URL supaya toast tidak muncul lagi saat di-refresh. Pakai
    // window.history, bukan router.replace, supaya tidak memicu navigasi
    // server dan tidak membuang state halaman yang sedang dibuka.
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    window.history.replaceState(null, "", url.toString());
  }, [code, message]);

  return null;
}
