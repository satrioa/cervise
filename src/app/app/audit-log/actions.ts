"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { mapAuditRows, type AuditLogInput, type AuditRow } from "@/lib/operational/audit-log";

const LOG_ROW_CAP = 500;

export type AuditLogData = {
  rows: AuditRow[];
  branchName: string;
};

export async function getAuditLog(): Promise<AuditLogData> {
  const actor = await getActiveTenant();
  if (!actor.branchId) throw new Error("Branch not set for tenant");
  const { supabase, branchId } = actor;

  const [logsResult, branchResult] = await Promise.all([
    supabase
      .from("cervise_service_logs")
      .select("id, created_at, action, from_value, to_value, payload, servis_id, branch_id, actor_id")
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false })
      .limit(LOG_ROW_CAP),
    supabase.from("branches").select("id, name").eq("id", branchId).maybeSingle(),
  ]);

  if (logsResult.error) throw new Error(logsResult.error.message);
  if (branchResult.error) throw new Error(branchResult.error.message);

  const logs = (logsResult.data ?? []) as AuditLogInput[];
  const branchIds = Array.from(new Set(logs.map((log) => log.branch_id)));
  const actorIds = Array.from(new Set(logs.map((log) => log.actor_id).filter((id): id is string => Boolean(id))));

  const [profilesResult, branchesResult] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
    branchIds.length
      ? supabase.from("branches").select("id, name").in("id", branchIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error) throw new Error(profilesResult.error.message);
  if (branchesResult.error) throw new Error(branchesResult.error.message);

  // Roles live on employees, keyed by profile, so join them separately.
  const roleByProfile = new Map<string, string>();
  if (actorIds.length) {
    const { data: employees, error: employeesError } = await supabase
      .from("employees")
      .select("profile_id, role")
      .in("profile_id", actorIds);
    if (employeesError) throw new Error(employeesError.message);
    for (const employee of (employees ?? []) as { profile_id: string; role: string }[]) {
      roleByProfile.set(employee.profile_id, employee.role);
    }
  }

  const profiles = ((profilesResult.data ?? []) as { id: string; full_name: string | null }[]).map((profile) => ({
    id: profile.id,
    full_name: profile.full_name,
    role: roleByProfile.get(profile.id) ?? null,
  }));

  return {
    rows: mapAuditRows({
      logs,
      actors: profiles,
      branches: (branchesResult.data ?? []) as { id: string; name: string }[],
    }),
    branchName: (branchResult.data as { name: string } | null)?.name ?? "—",
  };
}
