import { CreditCardIcon } from "lucide-react";
import { getInvoices } from "../actions";
import { InvoiceReviewTable } from "@/components/owner/invoice-review-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function OwnerBillingPage() {
  const invoices = await getInvoices();
  const { data: proofs } = await createAdminClient()
    .from("payment_proofs")
    .select("id, invoice_id, storage_path, file_name, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const proofsByInvoice = (proofs ?? []).reduce<Record<string, { storage_path: string; file_name: string }[]>>(
    (acc, proof) => {
      (acc[proof.invoice_id] ??= []).push({ storage_path: proof.storage_path, file_name: proof.file_name });
      return acc;
    },
    {},
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"><CreditCardIcon className="size-3.5" /> Billing operations</div>
        <h1 className="mt-1 font-heading text-3xl">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Verifikasi bukti transfer, approve invoice, dan penuhi langganan/top-up dengan aman.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice queue</CardTitle>
          <CardDescription>
            Status pembayaran dan fulfillment terpisah. Approval hanya oleh platform owner; bukti upload tidak otomatis melunasi invoice.
          </CardDescription>
        </CardHeader>
        <CardContent><InvoiceReviewTable invoices={invoices} proofsByInvoice={proofsByInvoice} /></CardContent>
      </Card>
    </div>
  );
}
