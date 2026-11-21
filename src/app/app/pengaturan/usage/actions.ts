"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenantForBilling } from "@/lib/supabase/actor";
import { canAccessActor } from "@/lib/nav/manifest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createTopupOrder,
  getProofSignedUrl,
  uploadPaymentProof,
} from "@/lib/payments/payment-service";
import { ACTIVE_PAYMENT_PROVIDER } from "@/lib/payments/provider";

async function requireUsageActor() {
  const actor = await getActiveTenantForBilling();
  if (!canAccessActor(actor, "pengaturan_usage")) {
    throw new Error("Role tidak diizinkan mengakses usage & billing");
  }
  return actor;
}

export async function createTopupOrderAction(packageId: string) {
  const actor = await requireUsageActor();
  if (!packageId) throw new Error("Paket top-up tidak valid");
  if (ACTIVE_PAYMENT_PROVIDER.id !== "manual_transfer") {
    throw new Error(ACTIVE_PAYMENT_PROVIDER.notice);
  }
  const invoiceId = await createTopupOrder(actor.orgId, packageId);
  revalidatePath("/app/pengaturan/usage");
  revalidatePath("/app/pengaturan/subscription");
  return { invoiceId };
}

export async function uploadPaymentProofAction(formData: FormData) {
  const actor = await requireUsageActor();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const file = formData.get("file");
  if (!invoiceId || !(file instanceof File)) {
    throw new Error("Invoice dan file bukti wajib diisi");
  }

  // Kepemilikan invoice diverifikasi di server, bukan dipercaya dari client.
  const { data: invoice, error } = await createAdminClient()
    .from("invoices")
    .select("id, status, organization_id")
    .eq("id", invoiceId)
    .eq("organization_id", actor.orgId)
    .maybeSingle();
  if (error) throw error;
  if (!invoice) throw new Error("Invoice tidak ditemukan");
  if (invoice.status !== "pending") throw new Error("Invoice sudah diproses");

  const bytes = Buffer.from(await file.arrayBuffer());
  await uploadPaymentProof({
    organizationId: actor.orgId,
    invoiceId,
    fileName: file.name,
    contentType: file.type,
    bytes,
    uploadedBy: actor.userId ?? null,
  });
  revalidatePath("/app/pengaturan/usage");
  return { ok: true };
}

export async function getPaymentProofUrlAction(storagePath: string) {
  const actor = await requireUsageActor();
  const { data: proof, error } = await createAdminClient()
    .from("payment_proofs")
    .select("id, organization_id")
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (error) throw error;
  if (!proof || proof.organization_id !== actor.orgId) {
    throw new Error("Bukti tidak ditemukan");
  }
  return getProofSignedUrl(storagePath);
}
