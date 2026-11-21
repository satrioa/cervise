"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { canAccessActor } from "@/lib/nav/manifest";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeQuota, reserveQuota } from "@/lib/payments/quota";

/**
 * Kirim manual lewat wa.me tidak punya callback provider. Kami tetap mencatat
 * satu unit kuota per invoice dengan kunci idempotensi tetap, supaya klik
 * berulang tidak memotong dua kali. Status "sent" berarti tautan dibuka, bukan
 * bukti delivered — keterbatasan ini dicatat di laporan akhir.
 */
export async function recordManualWaSend(invoiceKey: string) {
  const actor = await getActiveTenant();
  if (!canAccessActor(actor, "servis")) {
    throw new Error("Role tidak diizinkan mengirim invoice");
  }
  if (!invoiceKey) throw new Error("Data pengiriman tidak valid");

  // branch_id berasal dari actor (server), bukan dari client.
  let branchId = actor.branchId;
  if (!branchId) {
    const { data: firstBranch } = await createAdminClient()
      .from("branches")
      .select("id")
      .eq("organization_id", actor.orgId)
      .limit(1)
      .maybeSingle();
    branchId = firstBranch?.id ?? null;
  }
  if (!branchId) throw new Error("Cabang tidak ditemukan");

  const idempotencyKey = `manual-wa:${invoiceKey}:${branchId}`;
  const reservation = await reserveQuota({
    organizationId: actor.orgId,
    branchId,
    idempotencyKey,
    messageType: "manual_invoice",
  });
  if (!reservation.allowed) {
    throw new Error("Kuota WhatsApp habis. Hubungi admin untuk menambah kuota.");
  }
  await finalizeQuota({ idempotencyKey, status: "sent" });
  return { ok: true };
}
