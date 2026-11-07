import { requireMenu } from "@/lib/auth/require-menu";
import TransaksiPage from "./transaksi-client";

/**
 * Route guard untuk halaman ini. Menyembunyikan link di sidebar tidak cukup:
 * URL masih bisa dibuka langsung, lalu server action di dalamnya melempar
 * error yang tidak informatif bagi pengguna.
 *
 * `q` dipakai command palette supaya kata kunci langsung terisi.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireMenu("keuangan_transaksi");
  const { q = "" } = await searchParams;
  return <TransaksiPage initialQuery={q} />;
}
