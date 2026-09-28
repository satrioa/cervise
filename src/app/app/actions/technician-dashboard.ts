"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import {
  buildAttentionQueue,
  buildTechnicianKpi,
  type AttentionItem,
  type BranchIntensif,
  type TechnicianKpi,
  type TechnicianServiceInput,
} from "@/lib/operational/technician-dashboard";

/**
 * Data untuk dashboard teknisi: antrean yang butuh perhatian dan KPI target.
 *
 * Perhitungan murni ada di `@/lib/operational/technician-dashboard`; file ini
 * hanya mengambil baris lalu meneruskannya.
 */

// Dashboard menampilkan antrean, bukan laporan — barisnya dibatasi supaya
// payload tidak tumbuh bersama riwayat.
const SERVICE_ROW_CAP = 2000;

export type TechnicianDashboardData = {
  attention: AttentionItem[];
  kpi: TechnicianKpi;
};

export type TechnicianDashboardResult = {
  data: TechnicianDashboardData;
  error: string | null;
};

const EMPTY: TechnicianDashboardData = {
  attention: [],
  kpi: { target: null, selesai: 0, targetPct: null, unset: true },
};

export async function getTechnicianDashboardData(): Promise<TechnicianDashboardResult> {
  try {
    const { supabase, branchId, userId } = await getActiveTenant();
    if (!branchId) {
      return { data: EMPTY, error: "Cabang belum ditetapkan untuk akun ini" };
    }

    const [servicesResult, branchResult] = await Promise.all([
      supabase
        .from("cervise_services")
        .select("id, service_number, created_at, updated_at, branch_id, teknisi_id, status, price, device")
        .eq("branch_id", branchId)
        .order("created_at", { ascending: false })
        .limit(SERVICE_ROW_CAP),
      supabase
        .from("branches")
        .select("is_intensif_enabled, intensif_mode, intensif_value, intensif_target_count")
        .eq("id", branchId)
        .maybeSingle(),
    ]);

    if (servicesResult.error) throw new Error(servicesResult.error.message);

    const services = (servicesResult.data ?? []) as TechnicianServiceInput[];
    const now = new Date();
    const branch = branchResult.data as BranchIntensif | null;

    return {
      data: {
        attention: buildAttentionQueue(services, userId, now),
        kpi: buildTechnicianKpi(services, userId, branch, now),
      },
      error: null,
    };
  } catch (cause) {
    return {
      data: EMPTY,
      error: cause instanceof Error ? cause.message : "Gagal memuat data dashboard",
    };
  }
}
