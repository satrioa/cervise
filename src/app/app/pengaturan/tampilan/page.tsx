import { requireMenu } from "@/lib/auth/require-menu";
import { SettingsAppearanceShowcasePage } from "@/components/settings-appearance";

export default async function TampilanPage() {
  // Tema disimpan di cookie `cervise-theme`, jadi sifatnya global lintas cabang
  // dan seluruh pengguna — bukan milik satu role. Hanya MASTER_ADMIN yang
  // boleh mengubahnya.
  await requireMenu("pengaturan_tampilan");
  return <SettingsAppearanceShowcasePage />;
}
