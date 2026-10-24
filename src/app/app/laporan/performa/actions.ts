"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { assertCanRead } from "@/lib/auth/require-menu";
import { applyBranchScope } from "@/lib/supabase/branch-scope";
import { rentangBulanSekarang } from "@/lib/operational/periode-bulan";
import {
  buildPerformaTeknisi,
  type BranchIntensif,
  type PerformaTeknisi,
  type ServiceForTech,
  type TechnicianInput,
} from "@/lib/operational/performa-teknisi";

const ROW_CAP = 5000;

export type PerformaTeknisiData = {
  report: PerformaTeknisi;
  branches: { id: string; name: string }[];
  periode: { dari: string; sampai: string };
};

export type PerformaTeknisiResult = { data: PerformaTeknisiData; error: string | null };

export async function getPerformaTeknisi(): Promise<PerformaTeknisiResult> {
  const now = new Date();
  const { from, to } = rentangBulanSekarang(now);
  try {
    const actor = await getActiveTenant();
    // Guard di page.tsx tidak menutup jalur ini: server action bisa dipanggil
    // langsung. Hanya manifest yang menentukan role, jadi cek ulang di sini.
    assertCanRead(actor, "/app/laporan/performa");
    const { supabase } = actor;

    // employees.role is the authoritative upper-cased role; profiles.role is
    // legacy lower-case and must not be filtered on.
    const [employeesResult, branchesResult, servicesResult, undatedResult] = await Promise.all([
      applyBranchScope(
        supabase
          .from("employees")
          .select("profile_id, branch_id, profiles(id, full_name)")
          .eq("role", "TECHNICIAN")
          .eq("is_active", true),
        actor,
      ),
      applyBranchScope(
        supabase
          .from("branches")
          .select("id, name, is_intensif_enabled, intensif_mode, intensif_value, intensif_target_count"),
        actor,
        "id",
      ).order("name"),
      applyBranchScope(
        supabase
          .from("cervise_services")
          .select("teknisi_id, status, price, completed_at")
          .not("teknisi_id", "is", null)
          .gte("completed_at", from.toISOString())
          .lt("completed_at", to.toISOString()),
        actor,
      ).limit(ROW_CAP),
      // Servis selesai tanpa tanggal selesai tidak bisa difilter per periode,
      // jadi diambil terpisah lalu hanya dipakai untuk ditandai di UI. Jumlahnya
      // sedikit, dan cap ROW_CAP di sini hanya penjaga.
      applyBranchScope(
        supabase
          .from("cervise_services")
          .select("teknisi_id, status, price, completed_at")
          .not("teknisi_id", "is", null)
          .is("completed_at", null)
          .in("status", ["Selesai", "Sudah Diambil"]),
        actor,
      ).limit(ROW_CAP),
    ]);

    if (employeesResult.error) throw new Error(employeesResult.error.message);
    if (branchesResult.error) throw new Error(branchesResult.error.message);
    if (servicesResult.error) throw new Error(servicesResult.error.message);
    if (undatedResult.error) throw new Error(undatedResult.error.message);

    const branchRows = (branchesResult.data ?? []) as (BranchIntensif & { id: string; name: string })[];
    const branchNames = new Map(branchRows.map((branch) => [branch.id, branch.name]));
    const branchIntensif: Record<string, BranchIntensif> = {};
    for (const branch of branchRows) {
      branchIntensif[branch.id] = {
        is_intensif_enabled: Boolean(branch.is_intensif_enabled),
        intensif_mode: branch.intensif_mode ?? "percent",
        intensif_value: branch.intensif_value ?? 0,
        intensif_target_count: branch.intensif_target_count ?? null,
      };
    }

    const technicians = (
      employeesResult.data as unknown as {
        profile_id: string;
        branch_id: string | null;
        profiles: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null;
      }[]
    ).map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        profile_id: row.profile_id,
        full_name: profile?.full_name ?? null,
        branch_id: row.branch_id,
        branch_name: row.branch_id ? (branchNames.get(row.branch_id) ?? null) : null,
      } satisfies TechnicianInput;
    });

    return {
      data: {
        report: buildPerformaTeknisi({
          technicians,
          services: [...(servicesResult.data ?? []), ...(undatedResult.data ?? [])] as ServiceForTech[],
          branchIntensif,
          now,
        }),
        branches: branchRows.map(({ id, name }) => ({ id, name })),
        periode: { dari: from.toISOString(), sampai: to.toISOString() },
      },
      error: null,
    };
  } catch (cause) {
    return {
      data: {
        report: buildPerformaTeknisi({ technicians: [], services: [], branchIntensif: {}, now }),
        branches: [],
        periode: { dari: from.toISOString(), sampai: to.toISOString() },
      },
      error: cause instanceof Error ? cause.message : "Gagal memuat performa teknisi",
    };
  }
}
