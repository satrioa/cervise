import Link from "next/link";
import { ArrowLeftIcon, WalletIcon } from "lucide-react";
import { requireMenu } from "@/lib/auth/require-menu";
import { getActiveTenant } from "@/lib/supabase/actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { TopupPurchaseFlow } from "@/components/billing/topup-purchase-flow";
import { Button } from "@/components/ui/button";

export default async function BeliKuotaWhatsAppPage() {
  await requireMenu("pengaturan_usage");
  const actor = await getActiveTenant();
  const admin = createAdminClient();
  const [packagesResult, invoicesResult] = await Promise.all([
    admin
      .from("wa_topup_packages")
      .select("id, code, name, message_quantity, price_idr")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("invoices")
      .select("id, invoice_number, status, amount, wa_message_quantity, created_at")
      .eq("organization_id", actor.orgId)
      .eq("invoice_type", "topup")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/pengaturan/usage">
          <ArrowLeftIcon className="size-4" /> Kembali ke pemakaian
        </Link>
      </Button>
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          <WalletIcon className="size-3.5" /> Top-up kuota
        </div>
        <h1 className="mt-1 font-heading text-2xl sm:text-3xl">Beli kuota WhatsApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pilih paket, lanjutkan pembayaran, dan kuota akan aktif otomatis setelah pembayaran diterima.
        </p>
      </div>

      <TopupPurchaseFlow
        packages={(packagesResult.data ?? []) as never}
        invoices={(invoicesResult.data ?? []) as never}
      />
    </div>
  );
}
