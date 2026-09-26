import { NextResponse } from "next/server";
import { buildRenewalWhatsAppMessage, buildWhatsAppUrl } from "@/lib/billing/renewal";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { sendFonnteWA } from "@/lib/fonnte";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RenewalInvoiceRow = {
  id: string;
  invoice_number: string;
  amount: number;
  period_start: string;
  period_end: string;
  organization: { id: string; name: string; contact_phone: string | null };
  package: { name: string };
};

function isSkippedResult(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    "skip" in value &&
    value.skip === true
  );
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { error: processError } = await admin.rpc("process_subscription_renewals");

    if (processError) {
      throw processError;
    }

    const { data: settings, error: settingsError } = await admin
      .from("platform_settings")
      .select("owner_whatsapp")
      .eq("id", true)
      .maybeSingle();

    if (settingsError) {
      throw settingsError;
    }

    const ownerPhone =
      process.env.OWNER_WHATSAPP_NUMBER || settings?.owner_whatsapp || null;
    const { data, error: invoicesError } = await admin
      .from("invoices")
      .select(
        "id, invoice_number, amount, period_start, period_end, organization:organizations!inner(id, name, contact_phone), package:packages!inner(name)",
      )
      .eq("invoice_type", "renewal")
      .eq("status", "pending")
      .is("whatsapp_sent_at", null);

    if (invoicesError) {
      throw invoicesError;
    }

    const invoices = (data ?? []) as unknown as RenewalInvoiceRow[];
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const invoice of invoices) {
      if (!invoice.organization.contact_phone || !ownerPhone) {
        skipped += 1;
        continue;
      }

      const { data: claimed, error: claimError } = await admin
        .from("invoices")
        .update({ whatsapp_sent_at: new Date().toISOString() })
        .eq("id", invoice.id)
        .is("whatsapp_sent_at", null)
        .select("id");

      if (claimError) {
        failed += 1;
        continue;
      }
      if (!claimed || claimed.length === 0) {
        skipped += 1;
        continue;
      }

      const releaseClaim = async () => {
        await admin
          .from("invoices")
          .update({ whatsapp_sent_at: null })
          .eq("id", invoice.id);
      };

      const message = [
        buildRenewalWhatsAppMessage({
          tenantName: invoice.organization.name,
          tenantId: invoice.organization.id,
          packageName: invoice.package.name,
          invoiceId: invoice.invoice_number,
          amount: invoice.amount,
          periodStart: new Date(invoice.period_start),
          periodEnd: new Date(invoice.period_end),
        }),
        "",
        `Konfirmasi pembayaran: ${buildWhatsAppUrl(
          ownerPhone,
          `Halo Kak, saya mau renew paket ${invoice.package.name}.`,
        )}`,
      ].join("\n");

      try {
        const result = await sendFonnteWA(
          invoice.organization.contact_phone,
          message,
        );

        if (isSkippedResult(result)) {
          await releaseClaim();
          skipped += 1;
          continue;
        }

        sent += 1;
      } catch {
        await releaseClaim();
        failed += 1;
      }
    }

    return NextResponse.json({ sent, skipped, failed });
  } catch {
    return NextResponse.json(
      { error: "Renewal processing failed" },
      { status: 500 },
    );
  }
}
