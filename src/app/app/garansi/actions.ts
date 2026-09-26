"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { isManagerRole } from "@/lib/auth/authorization";
import {
  addGaransiDays,
  mapGaransiListRows,
  normalizeGaransiUnit,
  toDays,
  type GaransiListRow,
  type GaransiServiceInput,
  type GaransiUnit,
} from "@/lib/operational/garansi-list";

async function getBranchAndUser() {
  const actor = await getActiveTenant();
  if (!actor.branchId) throw new Error("Branch not set for tenant");
  return { supabase: actor.supabase, userId: actor.userId, branchId: actor.branchId, role: actor.role };
}

export async function getGaransiList(): Promise<GaransiListRow[]> {
  const { supabase, branchId } = await getBranchAndUser();
  const { data, error } = await supabase
    .from("cervise_services")
    .select("id, device, status, garansi_value, garansi_unit, garansi_until, created_at, customer_id, branch_id")
    .eq("branch_id", branchId)
    .not("garansi_value", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const services = (data ?? []) as GaransiServiceInput[];
  if (services.length === 0) return [];

  const customerIds = services.map((service) => service.customer_id).filter((id): id is string => Boolean(id));
  const branchIds = Array.from(new Set(services.map((service) => service.branch_id)));

  const [customersResult, branchesResult] = await Promise.all([
    customerIds.length
      ? supabase.from("cervise_customers").select("id, name, phone").in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("branches").select("id, name").in("id", branchIds),
  ]);
  if (customersResult.error) throw new Error(customersResult.error.message);
  if (branchesResult.error) throw new Error(branchesResult.error.message);

  return mapGaransiListRows({
    services,
    customers: (customersResult.data ?? []) as { id: string; name: string; phone: string | null }[],
    branches: (branchesResult.data ?? []) as { id: string; name: string }[],
  });
}

export async function extendGaransi(id: string, value: number, unit: GaransiUnit) {
  const { supabase, branchId, role, userId } = await getBranchAndUser();
  if (!isManagerRole(role)) throw new Error("Hanya admin yang boleh memperpanjang garansi");
  if (!id) throw new Error("ID wajib");
  if (!Number.isFinite(value) || value <= 0) throw new Error("Durasi garansi harus lebih dari 0");

  const { data: service, error: readError } = await supabase
    .from("cervise_services")
    .select("id, device, created_at")
    .eq("id", id)
    .eq("branch_id", branchId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!service) throw new Error("Servis tidak ditemukan");

  const normalizedUnit = normalizeGaransiUnit(unit);
  const base = new Date();
  const until = addGaransiDays(base, toDays(value, normalizedUnit));

  const { error: updateError } = await supabase
    .from("cervise_services")
    .update({ garansi_value: value, garansi_unit: normalizedUnit, garansi_until: until.toISOString() })
    .eq("id", id)
    .eq("branch_id", branchId);
  if (updateError) throw new Error(updateError.message);

  await supabase.from("cervise_service_logs").insert({
    branch_id: branchId,
    servis_id: id,
    actor_id: userId,
    action: "extend_garansi",
    to_value: `${value} ${normalizedUnit}`,
    payload: { garansi_value: value, garansi_unit: normalizedUnit, garansi_until: until.toISOString() },
  });

  return { id, garansiUntil: until.toISOString() };
}
