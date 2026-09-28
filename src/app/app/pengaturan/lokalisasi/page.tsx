import { requireMenu } from "@/lib/auth/require-menu";
import { SettingsLocalizationShowcasePage } from "@/components/settings-localization";

export default async function LokalisasiPage() {
  // Bahasa dan mata uang tersimpan di `profiles.settings.locale` — milik
  // pengguna, bukan milik tenant. Semua role boleh mengubah miliknya sendiri.
  await requireMenu("pengaturan_lokalisasi");
  return <SettingsLocalizationShowcasePage />;
}
