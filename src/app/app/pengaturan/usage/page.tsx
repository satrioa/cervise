import { requireMenu } from "@/lib/auth/require-menu";
import UsagePage from "./pengaturan-usage-client";

/**
 * Route guard untuk halaman ini. Menyembunyikan link di sidebar tidak cukup:
 * URL masih bisa dibuka langsung, lalu server action di dalamnya melempar
 * error yang tidak informatif bagi pengguna.
 */
export default async function Page() {
  await requireMenu("pengaturan_usage");
  return <UsagePage />;
}
