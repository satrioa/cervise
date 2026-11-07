import { requireMenu } from "@/lib/auth/require-menu";
import GaransiPage from "./garansi-client";

/**
 * Route guard untuk halaman ini. Menyembunyikan link di sidebar tidak cukup:
 * URL masih bisa dibuka langsung, lalu server action di dalamnya melempar
 * error yang tidak informatif bagi pengguna.
 *
 * `q`/`status` dipakai command palette supaya hasil pencarian langsung tampil.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireMenu("garansi");
  const { q = "", status = "" } = await searchParams;
  return <GaransiPage initialQuery={q} initialStatus={status || "Semua"} />;
}
