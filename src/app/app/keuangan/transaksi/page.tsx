import { requireMenu } from "@/lib/auth/require-menu";
import TransaksiPage from "./transaksi-client";

/**
 * Route guard untuk halaman ini. Menyembunyikan link di sidebar tidak cukup:
 * URL masih bisa dibuka langsung, lalu server action di dalamnya melempar
 * error yang tidak informatif bagi pengguna.
 *
 * `q` dipakai command palette supaya kata kunci langsung terisi.
 *
 * Kuncinya harus href rute, bukan kapabilitas `keuangan_transaksi`: kapabilitas
 * itu mengikuti `finance.write` dan mengecualikan FRONTLINER, padahal sidebar
 * membuka menu ini untuk CASHIERS lewat `finance.read`.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireMenu("/app/keuangan/transaksi");
  const { q = "" } = await searchParams;
  return <TransaksiPage initialQuery={q} />;
}
