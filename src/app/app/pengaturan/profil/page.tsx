import { requireMenu } from "@/lib/auth/require-menu";
import { SettingsProfileKaggo } from "@/components/settings-profile";
import { getProfileInitial, updateProfile, requestPasswordReset } from "./actions";

export default async function PengaturanProfilPage() {
  await requireMenu("/app/pengaturan/profil");
  // getProfileInitial tidak pernah gagal diam-diam. Dulu error apa pun
  // disembunyikan di balik profil palsu ("Master Admin", 0812000000, cabang
  // "Kaggo Pusat"), dan kalau lalu user menekan Simpan, updateProfile menulis
  // nama dan nomor telepon palsu itu menimpa profil asli. Sekarang error
  // dibiarkan naik supaya masalahnya terlihat.
  const initial = await getProfileInitial();

  return <SettingsProfileKaggo initial={initial} onSave={updateProfile} onResetPassword={requestPasswordReset} />;
}
