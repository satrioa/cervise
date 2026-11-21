import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** Server-only. Semua nominal & quantity berasal dari DB, bukan dari client. */

export type TopupPackage = {
  id: string;
  code: string;
  name: string;
  message_quantity: number;
  price_idr: number;
  is_active: boolean;
  sort_order: number;
};

export async function listTopupPackages(): Promise<TopupPackage[]> {
  const { data, error } = await createAdminClient()
    .from("wa_topup_packages")
    .select("id, code, name, message_quantity, price_idr, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TopupPackage[];
}

export async function createTopupOrder(organizationId: string, packageId: string): Promise<string> {
  const { data, error } = await createAdminClient().rpc("platform_create_topup_order", {
    p_organization_id: organizationId,
    p_package_id: packageId,
  });
  if (error) throw error;
  return data as string;
}

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function uploadPaymentProof(input: {
  organizationId: string;
  invoiceId: string;
  fileName: string;
  contentType: string;
  bytes: Buffer;
  uploadedBy: string | null;
}): Promise<void> {
  if (!ALLOWED_TYPES.has(input.contentType)) {
    throw new Error("Format bukti tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.");
  }
  if (input.bytes.length === 0 || input.bytes.length > MAX_PROOF_BYTES) {
    throw new Error("Ukuran bukti maksimal 5 MB.");
  }
  const ext = input.contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
  const path = `${input.organizationId}/${input.invoiceId}/${randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("payment-proofs")
    .upload(path, input.bytes, { contentType: input.contentType, upsert: false });
  if (uploadError) throw uploadError;

  const { error: insertError } = await admin.from("payment_proofs").insert({
    invoice_id: input.invoiceId,
    organization_id: input.organizationId,
    storage_path: path,
    file_name: input.fileName.slice(0, 200),
    content_type: input.contentType,
    size_bytes: input.bytes.length,
    uploaded_by: input.uploadedBy,
  });
  if (insertError) {
    await admin.storage.from("payment-proofs").remove([path]);
    throw insertError;
  }
}

export async function getProofSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .storage.from("payment-proofs")
    .createSignedUrl(storagePath, 60 * 60);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

export async function getTenantWallet(organizationId: string) {
  const { data, error } = await createAdminClient()
    .from("whatsapp_quota_wallets")
    .select("organization_id, included_limit, included_used, topup_balance, period_start, period_end")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTenantQuotaBreakdown(organizationId: string, since?: string) {
  const query = createAdminClient()
    .from("whatsapp_usage_logs")
    .select("branch_id, quota_source, delivery_status, quota_units, created_at")
    .eq("organization_id", organizationId);
  if (since) query.gte("created_at", since);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getTenantLedger(organizationId: string, limit = 20) {
  const { data, error } = await createAdminClient()
    .from("whatsapp_quota_ledger")
    .select("id, transaction_type, amount, balance_after, description, reason, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
