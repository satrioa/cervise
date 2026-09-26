import { CreditCardIcon } from "lucide-react";
import { getInvoices } from "../actions";
import { InvoiceReviewTable } from "@/components/owner/invoice-review-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OwnerBillingPage() {
  const invoices = await getInvoices();
  return <div className="mx-auto max-w-7xl space-y-6"><div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"><CreditCardIcon className="size-3.5" /> Billing operations</div><h1 className="mt-1 font-heading text-3xl">Billing</h1><p className="mt-1 text-sm text-muted-foreground">Verifikasi pembayaran WhatsApp, approve invoice, dan buat replacement otomatis saat rejection.</p></div><Card><CardHeader><CardTitle className="text-base">Invoice queue</CardTitle><CardDescription>Renewal invoice dibuat otomatis H-7. Renewal tetap memakai access penuh selama grace.</CardDescription></CardHeader><CardContent><InvoiceReviewTable invoices={invoices} /></CardContent></Card></div>;
}
