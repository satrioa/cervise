import { requireMenu } from "@/lib/auth/require-menu";
import KategoriSparepartPage from "./kategori-sparepart-client";

/**
 * Route guard untuk halaman ini. Menyembunyikan link di sidebar tidak cukup:
 * URL masih bisa dibuka langsung, lalu server action di dalamnya melempar
 * error yang tidak informatif bagi pengguna.
 */
export default async function Page() {
  await requireMenu("kategori_sparepart");
  return <KategoriSparepartPage />;
}
