import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="font-heading text-2xl tracking-tight">Halaman tidak ditemukan</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Alamat yang Anda buka tidak ada, atau sudah dipindahkan.
      </p>
      <Link
        href="/"
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        Kembali ke beranda
      </Link>
    </div>
  );
}
