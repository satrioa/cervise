import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { MetaWaError, sendMetaWA, type TemplateParameter } from "@/lib/meta-wa";
import { finalizeQuota, releaseQuota, reserveQuota } from "@/lib/payments/quota";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RenewalInvoiceRow = {
  id: string;
  invoice_number: string;
  amount: number;
  period_start: string;
  period_end: string;
  organization: {
    id: string;
    name: string;
    contact_phone: string | null;
    owner_profile_id: string | null;
  };
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

function formatTanggal(value: string) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

const RENEWAL_TEMPLATE =
  process.env.META_WA_TEMPLATE_RENEWAL || "renewal_reminder_v1";

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

    const { data, error: invoicesError } = await admin
      .from("invoices")
      .select(
        "id, invoice_number, amount, period_start, period_end, organization:organizations!inner(id, name, contact_phone, owner_profile_id), package:packages!inner(name)",
      )
      .eq("invoice_type", "renewal")
      .eq("status", "pending")
      .is("whatsapp_sent_at", null);

    if (invoicesError) {
      throw invoicesError;
    }

    const invoices = (data ?? []) as unknown as RenewalInvoiceRow[];

    // owner_profile_id merujuk ke auth.users, jadi full_name diambil dari
    // profiles lewat query terpisah (PostgREST tidak bisa join lintas FK itu).
    const ownerIds = [
      ...new Set(
        invoices
          .map((invoice) => invoice.organization.owner_profile_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const ownerNames = new Map<string, string>();
    if (ownerIds.length > 0) {
      const { data: owners, error: ownersError } = await admin
        .from("profiles")
        .select("id, full_name")
        .in("id", ownerIds);
      if (ownersError) {
        throw ownersError;
      }
      for (const owner of owners ?? []) {
        const row = owner as { id: string; full_name: string | null };
        if (row.full_name) ownerNames.set(row.id, row.full_name);
      }
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const invoice of invoices) {
      if (!invoice.organization.contact_phone) {
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

      // Pesan renewal juga memakai wallet tenant yang sama dengan notifikasi
      // servis (shared lintas cabang). Kunci idempotensi per invoice.
      const idempotencyKey = `renewal-invoice:${invoice.id}`;
      const reservation = await reserveQuota({
        organizationId: invoice.organization.id,
        idempotencyKey,
        messageType: "renewal_invoice",
      });
      if (!reservation.allowed) {
        await releaseClaim();
        skipped += 1;
        continue;
      }

      // Nama variabel harus persis mengikuti template `renewal_reminder_v1`
      // yang sudah disetujui Meta: nama, tenant, nama_paket, tanggal_berakhir.
      const parameters: TemplateParameter[] = [
        {
          type: "text",
          parameter_name: "nama",
          value:
            (invoice.organization.owner_profile_id
              ? ownerNames.get(invoice.organization.owner_profile_id)
              : null) ?? invoice.organization.name,
        },
        { type: "text", parameter_name: "tenant", value: invoice.organization.name },
        { type: "text", parameter_name: "nama_paket", value: invoice.package.name },
        {
          type: "text",
          parameter_name: "tanggal_berakhir",
          value: formatTanggal(invoice.period_end),
        },
      ];

      try {
        const result = await sendMetaWA(
          invoice.organization.contact_phone,
          RENEWAL_TEMPLATE,
          parameters,
        );

        if (isSkippedResult(result)) {
          await releaseQuota(idempotencyKey);
          await releaseClaim();
          skipped += 1;
          continue;
        }

        await finalizeQuota({ idempotencyKey, status: "sent" });
        sent += 1;
      } catch (error) {
        await releaseQuota(idempotencyKey);
        // Nomor/template yang memang salah tidak akan pernah berhasil, jadi
        // klaim ditahan supaya tidak dipanggil ulang tiap jam. Token kedaluwarsa
        // atau masalah Meta lain scope-nya infrastruktur: pesannya masih layak,
        // jadi klaim dilepas dan dicoba lagi di run berikutnya.
        if (error instanceof MetaWaError && error.scope === "message") {
          failed += 1;
          continue;
        }
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
