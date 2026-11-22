import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  isPaidWebhook,
  verifyWebhookSignature,
  type WebhookBody,
} from "@/lib/payments/online-checkout";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Webhook pembayaran: verifikasi tanda tangan, lalu setujui invoice & isi kuota. */
export async function POST(request: Request) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: WebhookBody;
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!verifyWebhookSignature(body, serverKey)) {
    console.warn("webhook payment: signature ditolak", {
      order_id: body.order_id,
      status_code: body.status_code,
      gross_amount: body.gross_amount,
      transaction_status: body.transaction_status,
      signature_prefix: String(body.signature_key ?? "").slice(0, 12),
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  if (!isPaidWebhook(body)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const orderId = String(body.order_id ?? "");
  const paidAmount = Math.round(Number(body.gross_amount ?? 0));
  if (!orderId || !paidAmount) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .select("id, invoice_number, amount, status, invoice_type, organization_id")
    .eq("invoice_number", orderId)
    .eq("invoice_type", "topup")
    .maybeSingle();
  if (invoiceError) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!invoice) {
    // Bukan invoice top-up kita — abaikan supaya gateway tidak retry.
    return NextResponse.json({ received: true, ignored: true });
  }
  if (invoice.amount !== paidAmount) {
    return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
  }
  if (invoice.status === "approved") {
    return NextResponse.json({ received: true, already_approved: true });
  }
  if (invoice.status !== "pending") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const { error: approveError } = await admin
    .from("invoices")
    .update({
      status: "approved",
      paid_at: new Date().toISOString(),
      decision_note: "Pembayaran online terverifikasi",
    })
    .eq("id", invoice.id)
    .eq("status", "pending");
  if (approveError) {
    return NextResponse.json({ error: "approve_failed" }, { status: 500 });
  }

  const { error: fulfillError } = await admin.rpc("payment_apply_fulfillment", {
    p_invoice_id: invoice.id,
  });
  if (fulfillError) {
    return NextResponse.json({ error: "fulfillment_failed" }, { status: 500 });
  }

  revalidatePath("/app/pengaturan/usage");
  revalidatePath("/app/pengaturan/usage/beli");
  revalidatePath("/owner/billing");
  return NextResponse.json({ received: true, approved: true });
}
