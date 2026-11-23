"use client";

import { Button } from "@/components/ui/button";

/** Error boundary khusus pemilih tenant: pesan jelas, tanpa stack/minified React. */
export default function TenantPickerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
      <h1 className="font-heading text-2xl">Tidak bisa membuka tenant</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message && !error.digest
          ? error.message
          : "Pemilihan tenant gagal. Periksa akses atau masa langganan Anda, lalu coba lagi."}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => (window.location.href = "/login")}>Kembali ke login</Button>
        <Button onClick={reset}>Coba lagi</Button>
      </div>
    </div>
  );
}
