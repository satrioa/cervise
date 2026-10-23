"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
      <h1 className="font-heading text-2xl tracking-tight">Terjadi kesalahan</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Halaman ini gagal dimuat. Coba lagi; kalau tetap gagal, muat ulang halaman.
      </p>
      <Button onClick={reset}>Coba lagi</Button>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">Kode kesalahan: {error.digest}</p>
      ) : null}
    </div>
  );
}
