import { getSalesOrders } from "./actions";
import { PenjualanPOSClient } from "./penjualan-pos-client";

export default async function PenjualanPage() {
  let rows: Awaited<ReturnType<typeof getSalesOrders>> = [];
  try { rows = await getSalesOrders({}); } catch { rows = []; }

  return <PenjualanPOSClient initialRows={rows} />;
}
