import { getSalesOrders, getReceiptContext, type ReceiptContext } from "./actions";
import { PenjualanPOSClient } from "./penjualan-pos-client";

export default async function PenjualanPage() {
  let rows: Awaited<ReturnType<typeof getSalesOrders>> = [];
  try { rows = await getSalesOrders({}); } catch { rows = []; }

  // Identitas nota dibaca sekali di sini; kalau gagal, nota tetap tampil
  // dengan nama cabang dari context dan tanpa tagline.
  let receiptContext: ReceiptContext = { brandName: null, tagline: null, logoUrl: null, branchName: null, address: null, phone: null };
  try { receiptContext = await getReceiptContext(); } catch { /* nota tanpa identitas toko */ }

  return <PenjualanPOSClient initialRows={rows} receiptContext={receiptContext} />;
}
