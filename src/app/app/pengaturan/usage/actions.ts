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
import {
  createCheckoutRedirect,
  readCheckoutConfig,
} from "@/lib/payments/online-checkout";

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
  if (ACTIVE_PAYMENT_PROVIDER.id !== "online_checkout") {
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
  return {
    invoiceId,
    invoiceNumber: invoice?.invoice_number ?? "",
    amount: invoice?.amount ?? 0,
    quantity: invoice?.wa_message_quantity ?? 0,
  };
}

/** Membuat sesi checkout online untuk invoice top-up yang masih pending. */
export async function createCheckoutAction(invoiceId: string) {
  const actor = await requireUsageActor();
  if (!invoiceId) throw new Error("Invoice tidak valid");

  const config = readCheckoutConfig();
  if (!config) throw new Error("Pembayaran online belum tersedia. Hubungi admin.");

  const admin = createAdminClient();
  const [{ data: invoice, error: invoiceError }, { data: profile }] = await Promise.all([
    admin
      .from("invoices")
      .select("id, invoice_number, amount, status, invoice_type, organization_id")
      .eq("id", invoiceId)
      .eq("organization_id", actor.orgId)
      .eq("invoice_type", "topup")
      .maybeSingle(),
    admin.from("profiles").select("full_name, email, phone").eq("id", actor.userId ?? "").maybeSingle(),
  ]);
  if (invoiceError) throw invoiceError;
  if (!invoice) throw new Error("Invoice top-up tidak ditemukan");
  if (invoice.status !== "pending") throw new Error("Invoice sudah diproses");

  const redirectUrl = await createCheckoutRedirect(
    {
      orderId: invoice.invoice_number,
      grossAmount: invoice.amount,
      firstName: profile?.full_name ?? "Pelanggan Kaggo",
      email: profile?.email ?? "",
      phone: profile?.phone,
    },
    config,
  );

  return { redirectUrl };
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
