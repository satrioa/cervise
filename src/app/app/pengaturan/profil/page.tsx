import { SettingsProfileCervise } from "@/components/settings-profile";
import { getProfileInitial, updateProfile, requestPasswordReset } from "./actions";

export default async function PengaturanProfilPage() {
  let initial: Awaited<ReturnType<typeof getProfileInitial>>;
  try {
    initial = await getProfileInitial();
  } catch {
    initial = {
      fullName: "Master Admin",
      email: "admin@cervise.local",
      phone: "0812000000",
      branchId: null,
      role: "MASTER_ADMIN",
      isMasterAdmin: true,
      cabangOptions: [{ id: "default", name: "Cervise Pusat" }],
    };
  }

  return <SettingsProfileCervise initial={initial} onSave={updateProfile} onResetPassword={requestPasswordReset} />;
}
