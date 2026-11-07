import { requireMenu } from "@/lib/auth/require-menu";
import ArusKasPage from "./arus-kas-client";

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
  await requireMenu("/app/keuangan/arus-kas");
  const { q = "" } = await searchParams;
  return <ArusKasPage initialQuery={q} />;
}
