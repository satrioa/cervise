"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenantForBilling } from "@/lib/supabase/actor";
import { canAccessActor } from "@/lib/nav/manifest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getProofSignedUrl,
  uploadPaymentProof,
} from "@/lib/payments/payment-service";
import { ACTIVE_PAYMENT_PROVIDER } from "@/lib/payments/provider";
import { buildTopupWaUrl } from "@/lib/payments/topup-wa";

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
  // RPC harus dipanggil dengan client sesi pengguna: auth.uid() dipakai untuk
  // verifikasi keanggotaan tenant di dalam database.
  const { data: invoiceId, error } = await actor.supabase.rpc("platform_create_topup_order", {
    p_organization_id: actor.orgId,
    p_package_id: packageId,
  });
  if (error) throw error;
  const { data: invoice } = await createAdminClient()
    .from("invoices")
    .select("invoice_number, amount, wa_message_quantity")
    .eq("id", invoiceId)
    .maybeSingle();
  revalidatePath("/app/pengaturan/usage");
  revalidatePath("/app/pengaturan/subscription");
  revalidatePath("/app/pengaturan/usage/beli");
  return {
    invoiceId,
    invoiceNumber: invoice?.invoice_number ?? "",
    amount: invoice?.amount ?? 0,
    quantity: invoice?.wa_message_quantity ?? 0,
  };
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

/**
 * Tenant sudah mengunggah bukti dan klik "Saya sudah transfer".
 * Status invoice sengaja tetap pending — owner yang memutuskan approve/reject.
 * Yang disimpan hanya penanda WA terkirim supaya tidak dobel notifikasi.
 */
export async function markTopupWaSentAction(input: { invoiceId: string; packageName: string }) {
  const actor = await requireUsageActor();
  if (!input.invoiceId) throw new Error("Invoice tidak valid");

  const admin = createAdminClient();
  const [{ data: invoice, error: invoiceError }, { data: proof }, { data: tenant }, { data: settings }, { data: pkg }] =
    await Promise.all([
      admin
        .from("invoices")
        .select("id, invoice_number, invoice_type, status, wa_message_quantity, amount, organization_id, wa_confirmation_sent_at")
        .eq("id", input.invoiceId)
        .eq("organization_id", actor.orgId)
        .eq("invoice_type", "topup")
        .maybeSingle(),
      admin
        .from("payment_proofs")
        .select("id")
        .eq("invoice_id", input.invoiceId)
        .eq("organization_id", actor.orgId)
        .limit(1),
      admin.from("organizations").select("name").eq("id", actor.orgId).maybeSingle(),
      admin.from("platform_settings").select("owner_whatsapp").eq("id", true).maybeSingle(),
      admin
        .from("wa_topup_packages")
        .select("name, message_quantity, price_idr")
        .eq("name", input.packageName)
        .eq("is_active", true)
        .maybeSingle(),
    ]);
  if (invoiceError) throw invoiceError;
  if (!invoice) throw new Error("Invoice top-up tidak ditemukan");
  if (invoice.status !== "pending") throw new Error("Invoice sudah diproses");
  if (!proof || proof.length === 0) throw new Error("Unggah bukti transfer terlebih dahulu");
  if (!settings?.owner_whatsapp) {
    throw new Error("Nomor WhatsApp admin belum diatur. Hubungi platform owner.");
  }
  if (
    !pkg ||
    pkg.message_quantity !== invoice.wa_message_quantity ||
    pkg.price_idr !== invoice.amount
  ) {
    throw new Error("Paket top-up tidak cocok dengan invoice");
  }

  const { error: updateError } = await admin
    .from("invoices")
    .update({ wa_confirmation_sent_at: new Date().toISOString() })
    .eq("id", invoice.id);
  if (updateError) throw updateError;

  revalidatePath("/app/pengaturan/usage");
  revalidatePath("/owner/billing");
  return {
    waUrl: buildTopupWaUrl({
      invoiceNumber: invoice.invoice_number,
      tenantName: tenant?.name ?? "Tenant Kaggo",
      packageName: pkg.name,
      quantity: invoice.wa_message_quantity ?? 0,
      amount: invoice.amount,
      adminWhatsapp: settings.owner_whatsapp,
    }),
  };
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
