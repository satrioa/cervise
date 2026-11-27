import { requireMenu } from "@/lib/auth/require-menu";
import SparepartPage from "./sparepart-client";

export default async function Page() {
  const actor = await requireMenu("kategori_sparepart");
  const isMasterAdmin = actor.role === "MASTER_ADMIN";
  // RPC request_stock hanya menerima ADMIN/FRONTLINER; master mendistribusikan langsung.
  const canRequest = ["ADMIN", "FRONTLINER"].includes(actor.role);
  return <SparepartPage isMasterAdmin={isMasterAdmin} canRequest={canRequest} />;
}
