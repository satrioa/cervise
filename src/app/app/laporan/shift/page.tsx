import { requireMenu } from "@/lib/auth/require-menu";
import LaporanShiftClient from "./shift-client";

/**
 * Route guard. Hanya MASTER_ADMIN dan ADMIN — FRONTLINER menutup shift-nya
 * sendiri lewat dialog Tutup Toko, dan tidak perlu melihat shift orang lain.
 */
export default async function LaporanShiftPage() {
  await requireMenu("/app/laporan/shift");
  return <LaporanShiftClient />;
}
