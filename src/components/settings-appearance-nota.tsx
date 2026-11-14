"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ReceiptAppearanceSection } from "@/components/settings-appearance-landing";
import type { PublicTenant } from "@/lib/public/landing";

export function NotaAppearancePage({ tenant }: { tenant: PublicTenant }) {
  const [tenantData, setTenant] = useState<PublicTenant>(tenant);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <PageHeader
        title="Tampilan Nota"
        titleClassName="font-heading text-2xl"
        description="Atur logo dan teks footer yang dicetak pada nota/struk (penjualan, servis, dan tutup toko)."
      />
      <div className="mx-auto max-w-3xl px-8 py-8">
        <ReceiptAppearanceSection tenant={tenantData} onSaved={setTenant} showHeader={false} />
      </div>
    </div>
  );
}
