"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import {
  buildLaporanServis,
  type LaporanServis,
  type ServisReportInput,
} from "@/lib/operational/laporan-servis";

const ROW_CAP = 2000;

export type LaporanServisData = {
  report: LaporanServis;
  branches: { id: string; name: string }[];
  technicians: { id: string; full_name: string | null }[];
};

export type LaporanServisQuery = {
  from?: string;
  to?: string;
  branchId?: string;
  teknisiId?: string;
};

export async function getLaporanServis(query: LaporanServisQuery): Promise<LaporanServisData> {
  const actor = await getActiveTenant();
  if (!actor.branchId) throw new Error("Branch not set for tenant");
  const { supabase } = actor;

  const branchesResult = await supabase.from("branches").select("id, name").order("name");
  if (branchesResult.error) throw new Error(branchesResult.error.message);
  const branches = (branchesResult.data ?? []) as { id: string; name: string }[];

  // employees.role is the authoritative, upper-cased role column. profiles.role is
  // legacy lower-case, so filtering profiles by 'teknisi' silently returns nothing.
  const techniciansResult = await supabase
    .from("employees")
    .select("profile_id, profiles(id, full_name)")
    .eq("role", "TECHNICIAN")
    .eq("is_active", true);
  if (techniciansResult.error) throw new Error(techniciansResult.error.message);
  // PostgREST returns an embedded to-one relation as an array unless it can infer
  // the FK, so accept both shapes.
  const technicians = (
    techniciansResult.data as unknown as {
      profile_id: string;
      profiles: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null;
    }[]
  )
    .map((row) => (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles))
    .filter((profile): profile is { id: string; full_name: string | null } => Boolean(profile?.id))
    .map((profile) => ({ id: profile.id, full_name: profile.full_name }));

  let request = supabase
    .from("cervise_services")
    .select("id, service_number, created_at, branch_id, teknisi_id, status, price, device")
    .order("created_at", { ascending: false })
    .limit(ROW_CAP);

  if (query.from) request = request.gte("created_at", query.from);
  if (query.to) request = request.lte("created_at", query.to);
  if (query.branchId && query.branchId !== "all") request = request.eq("branch_id", query.branchId);
  if (query.teknisiId && query.teknisiId !== "all") request = request.eq("teknisi_id", query.teknisiId);

  const { data, error } = await request;
  if (error) throw new Error(error.message);

  return {
    report: buildLaporanServis({
      services: (data ?? []) as ServisReportInput[],
      branches,
      technicians,
      now: new Date(),
    }),
    branches,
    technicians,
  };
}
