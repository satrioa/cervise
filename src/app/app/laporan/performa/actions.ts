"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
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
};

export type PerformaTeknisiResult = { data: PerformaTeknisiData; error: string | null };

export async function getPerformaTeknisi(): Promise<PerformaTeknisiResult> {
  try {
    const { supabase } = await getActiveTenant();

    // employees.role is the authoritative upper-cased role; profiles.role is
    // legacy lower-case and must not be filtered on.
    const [employeesResult, branchesResult, servicesResult] = await Promise.all([
      supabase
        .from("employees")
        .select("profile_id, branch_id, profiles(id, full_name)")
        .eq("role", "TECHNICIAN")
        .eq("is_active", true),
      supabase
        .from("branches")
        .select("id, name, is_intensif_enabled, intensif_mode, intensif_value, intensif_target_count")
        .order("name"),
      supabase
        .from("cervise_services")
        .select("teknisi_id, status, price")
        .not("teknisi_id", "is", null)
        .limit(ROW_CAP),
    ]);

    if (employeesResult.error) throw new Error(employeesResult.error.message);
    if (branchesResult.error) throw new Error(branchesResult.error.message);
    if (servicesResult.error) throw new Error(servicesResult.error.message);

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
          services: (servicesResult.data ?? []) as ServiceForTech[],
          branchIntensif,
          now: new Date(),
        }),
        branches: branchRows.map(({ id, name }) => ({ id, name })),
      },
      error: null,
    };
  } catch (cause) {
    return {
      data: { report: buildPerformaTeknisi({ technicians: [], services: [], branchIntensif: {}, now: new Date() }), branches: [] },
      error: cause instanceof Error ? cause.message : "Gagal memuat performa teknisi",
    };
  }
}
