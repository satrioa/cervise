"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { loadTechnicianHome } from "@/lib/home/home-data";
import type { TechnicianDashboardData } from "@/lib/home/types";

/**
 * Data untuk dashboard teknisi: antrean yang butuh perhatian dan KPI target.
 *
 * Perhitungan murni ada di `@/lib/operational/technician-dashboard`; pemuatan
 * barisnya ada di `@/lib/home/home-data` supaya Home bisa memakai loader yang
 * sama tanpa me-resolve aktor dua kali. Aksi ini dipakai untuk menyegarkan
 * dashboard setelah servis baru dibuat.
 */

export type { TechnicianDashboardData } from "@/lib/home/types";

export type TechnicianDashboardResult = {
  data: TechnicianDashboardData;
  error: string | null;
};

const EMPTY: TechnicianDashboardData = {
  attention: [],
  // `applicable: false` supaya kartu Target jatuh ke empty state "tidak ada
  // target bulanan", bukan empty state "belum diatur" -- yang menyiratkan ada
  // sesuatu yang bisa dikonfigurasi.
  kpi: { target: null, selesai: 0, targetPct: null, unset: true, applicable: false, masukHariIni: 0, selesaiHariIni: 0 },
  terbaru: [],
};

export async function getTechnicianDashboardData(): Promise<TechnicianDashboardResult> {
  try {
    const actor = await getActiveTenant();
    if (!actor.branchId) {
      return { data: EMPTY, error: "Cabang belum ditetapkan untuk akun ini" };
    }

    const data = await loadTechnicianHome({
      supabase: actor.supabase,
      branchId: actor.branchId,
      userId: actor.userId,
      role: actor.role,
    });

    return { data, error: null };
  } catch (cause) {
    return {
      data: EMPTY,
      error: cause instanceof Error ? cause.message : "Gagal memuat data dashboard",
    };
  }
}
