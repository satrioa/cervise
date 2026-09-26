"use server";
import { getActiveTenant } from "@/lib/supabase/actor";
import {
  buildLaporanPenjualan,
  type LaporanPenjualan,
  type SaleInput,
} from "@/lib/operational/laporan-penjualan";
const ROW_CAP = 2000;
export type LaporanPenjualanData = {
  report: LaporanPenjualan;
  branches: { id: string; name: string }[];
};
export type LaporanPenjualanResult = { data: LaporanPenjualanData; error: string | null };
export async function getLaporanPenjualan(query: {
  from?: string;
  to?: string;
  branchId?: string;
}): Promise<LaporanPenjualanResult> {
  const empty: LaporanPenjualanData = {
    report: buildLaporanPenjualan({ sales: [], branches: [], now: new Date() }),
    branches: [],
  };
  try {
    const { supabase } = await getActiveTenant();
    const branchesResult = await supabase.from("branches").select("id, name").order("name");
    if (branchesResult.error) throw new Error(branchesResult.error.message);
    const branches = (branchesResult.data ?? []) as { id: string; name: string }[];
    let request = supabase
      .from("cervise_sales")
      .select("id, sale_number, kas_date, subtotal, discount_total, total, paid, payment_status, payment_method, branch_id")
      .order("kas_date", { ascending: false })
      .limit(ROW_CAP);
    if (query.from) request = request.gte("kas_date", query.from);
    if (query.to) request = request.lte("kas_date", query.to);
    if (query.branchId && query.branchId !== "all") request = request.eq("branch_id", query.branchId);
    const { data, error } = await request;
    if (error) throw new Error(error.message);
    return {
      data: {
        report: buildLaporanPenjualan({
          sales: (data ?? []) as SaleInput[],
          branches,
          now: new Date(),
        }),
        branches,
      },
      error: null,
    };
  } catch (cause) {
    return { data: empty, error: cause instanceof Error ? cause.message : "Gagal memuat laporan penjualan" };
  }
}
