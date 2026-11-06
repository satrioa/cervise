import { requireMenu } from "@/lib/auth/require-menu";
import SparepartPage from "./sparepart-client";

export default async function Page() {
  const actor = await requireMenu("kategori_sparepart");
  const canManage = ["MASTER_ADMIN", "ADMIN"].includes(actor.role);
  return <SparepartPage canManage={canManage} />;
}
