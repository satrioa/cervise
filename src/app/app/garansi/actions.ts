"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import { isManagerRole } from "@/lib/auth/authorization";
import { applyBranchScope } from "@/lib/supabase/branch-scope";
import { canClaimGaransi } from "@/lib/operational/garansi-claim";
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
  const actor = await getActiveTenant();
  const { supabase } = actor;
  const query = applyBranchScope(
    supabase
      .from("cervise_services")
      .select("id, service_number, device, status, garansi_value, garansi_unit, garansi_until, created_at, customer_id, branch_id"),
    actor,
  );
  const { data, error } = await query
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

export type GaransiClaimRow = {
  id: string;
  originalServiceId: string;
  newServiceId: string | null;
  customerName: string;
  device: string;
  invoiceNo: string | null;
  reason: string;
  note: string | null;
  createdAt: string;
  /** Turunan dari status servis klaim — bukan kolom di garansi_claims. */
  status: string;
};

export async function createGaransiClaim(input: { originalServiceId: string; reason: string }) {
  const { supabase, branchId, role, userId } = await getBranchAndUser();
  if (!isManagerRole(role)) throw new Error("Hanya admin yang boleh klaim garansi");
  if (!input.originalServiceId) throw new Error("Servis tidak valid");
  const reason = input.reason.trim();
  if (reason.length < 3) throw new Error("Alasan klaim wajib diisi");

  const { data: service, error: readError } = await supabase
    .from("cervise_services")
    .select("id, device, customer_id, status, garansi_until, garansi_value, garansi_unit")
    .eq("id", input.originalServiceId)
    .eq("branch_id", branchId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!service) throw new Error("Servis tidak ditemukan");

  // Klaim lama dianggap masih berjalan bila servis turunannya belum selesai.
  const { data: claimServices, error: claimReadError } = await supabase
    .from("cervise_services")
    .select("id, status")
    .eq("parent_service_id", service.id);
  if (claimReadError) throw new Error(claimReadError.message);
  const hasOpenClaim = (claimServices ?? []).some(
    (item) => item.status !== "Sudah Diambil" && item.status !== "Batal",
  );

  const eligibility = canClaimGaransi({
    status: service.status,
    garansiUntil: service.garansi_until,
    garansiValue: Number(service.garansi_value ?? 0),
    garansiUnit: service.garansi_unit ?? "hari",
    hasOpenClaim,
  });
  if (!eligibility.eligible) throw new Error(eligibility.reason);

  const { data: claim, error: claimError } = await supabase
    .from("garansi_claims")
    .insert({
      branch_id: branchId,
      original_service_id: service.id,
      customer_id: service.customer_id,
      reason,
      claimed_by: userId,
    })
    .select("id")
    .single();
  if (claimError) throw new Error(claimError.message);

  // Nomor servis dibuat di database supaya urutan tetap aman saat banyak
  // klaim dibuat bersamaan di cabang yang sama.
  const { data: numberData, error: numberError } = await supabase.rpc("next_service_number", {
    p_branch_id: branchId,
  });
  if (numberError) throw new Error(numberError.message);

  // Servis klaim sengaja tanpa garansi: kalau ikut dihitung, perbaikan garansi
  // akan memicu klaim garansi berikutnya tanpa batas.
  const { data: claimService, error: serviceError } = await supabase
    .from("cervise_services")
    .insert({
      branch_id: branchId,
      customer_id: service.customer_id,
      service_number: (numberData as string | null) ?? null,
      device: service.device,
      complaint: `Klaim garansi: ${reason}`,
      kerusakan: [reason],
      status: "Masuk",
      price: 0,
      price_estimasi: 0,
      parent_service_id: service.id,
      created_by: userId,
      garansi_value: null,
      garansi_unit: null,
      garansi_until: null,
    })
    .select("id")
    .single();
  if (serviceError) throw new Error(serviceError.message);

  const { error: linkError } = await supabase
    .from("garansi_claims")
    .update({ new_service_id: claimService.id })
    .eq("id", claim.id);
  if (linkError) throw new Error(linkError.message);

  const { error: logError } = await supabase.from("cervise_service_logs").insert({
    branch_id: branchId,
    servis_id: claimService.id,
    actor_id: userId,
    action: "warranty_claim_created",
    to_value: service.id,
    payload: { claim_id: claim.id, reason },
  });
  if (logError) throw new Error(logError.message);

  revalidatePath("/app/garansi");
  revalidatePath("/app/servis");
  return { claimId: claim.id, serviceId: claimService.id };
}

export async function getGaransiClaims(): Promise<GaransiClaimRow[]> {
  const actor = await getActiveTenant();
  const { supabase } = actor;
  const query = applyBranchScope(
    supabase
      .from("garansi_claims")
      .select("id, original_service_id, new_service_id, customer_id, reason, note, created_at"),
    actor,
  );
  const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);

  const claims = (data ?? []) as {
    id: string;
    original_service_id: string;
    new_service_id: string | null;
    customer_id: string | null;
    reason: string;
    note: string | null;
    created_at: string;
  }[];
  if (claims.length === 0) return [];

  const claimServiceIds = claims.map((claim) => claim.new_service_id).filter((id): id is string => Boolean(id));
  const originalIds = Array.from(new Set(claims.map((claim) => claim.original_service_id)));
  const customerIds = Array.from(new Set(claims.map((claim) => claim.customer_id).filter((id): id is string => Boolean(id))));

  const [claimServicesResult, originalServicesResult, customersResult] = await Promise.all([
    claimServiceIds.length
      ? supabase.from("cervise_services").select("id, status").in("id", claimServiceIds)
      : Promise.resolve({ data: [] as { id: string; status: string }[], error: null }),
    supabase.from("cervise_services").select("id, service_number, device").in("id", originalIds),
    customerIds.length
      ? supabase.from("cervise_customers").select("id, name").in("id", customerIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ]);
  if (claimServicesResult.error) throw new Error(claimServicesResult.error.message);
  if (originalServicesResult.error) throw new Error(originalServicesResult.error.message);
  if (customersResult.error) throw new Error(customersResult.error.message);

  const claimServices = new Map((claimServicesResult.data ?? []).map((item) => [item.id, item]));
  const originalServices = new Map((originalServicesResult.data ?? []).map((item) => [item.id, item]));
  const customers = new Map((customersResult.data ?? []).map((item) => [item.id, item]));

  return claims.map((claim) => {
    const claimService = claim.new_service_id ? claimServices.get(claim.new_service_id) : undefined;
    const original = originalServices.get(claim.original_service_id);
    return {
      id: claim.id,
      originalServiceId: claim.original_service_id,
      newServiceId: claim.new_service_id,
      customerName: (claim.customer_id && customers.get(claim.customer_id)?.name) || "Pelanggan",
      device: original?.device ?? "—",
      invoiceNo: original?.service_number ?? null,
      reason: claim.reason,
      note: claim.note,
      createdAt: claim.created_at,
      status: claimService?.status ?? "Diajukan",
    };
  });
}
