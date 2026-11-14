"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ReceiptAppearanceSection } from "@/components/settings-appearance-landing";
import type { PublicTenant } from "@/lib/public/landing";

type NotaPreviewDraft = { receiptLogoUrl: string | null; receiptFooterText: string };

export function NotaAppearancePage({ tenant }: { tenant: PublicTenant }) {
  const [tenantData, setTenant] = useState<PublicTenant>(tenant);
  const [draft, setDraft] = useState<NotaPreviewDraft>({
    receiptLogoUrl: tenant.receiptLogoUrl ?? null,
    receiptFooterText: tenant.receiptFooterText ?? "",
  });

  const handlePreviewChange = useCallback((next: NotaPreviewDraft) => {
    setDraft(next);
  }, []);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <PageHeader
        title="Tampilan Nota"
        titleClassName="font-heading text-2xl"
        description="Atur logo dan teks footer yang dicetak pada nota/struk (penjualan, servis, dan tutup toko)."
      />
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <ReceiptAppearanceSection
              tenant={tenantData}
              onSaved={setTenant}
              showHeader={false}
              onPreviewChange={handlePreviewChange}
            />
          </div>
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Pratinjau
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Contoh tampilan umum pada nota/struk.
            </p>
            <div className="mt-3">
              <NotaReceiptPreview
                tenantName={tenantData.name}
                branchName={tenantData.branchName}
                branchAddress={tenantData.branchAddress}
                branchPhone={tenantData.branchPhone}
                logoUrl={draft.receiptLogoUrl}
                footerText={draft.receiptFooterText}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function NotaReceiptPreview({
  tenantName,
  branchName,
  branchAddress,
  branchPhone,
  logoUrl,
  footerText,
}: {
  tenantName: string;
  branchName?: string | null;
  branchAddress?: string | null;
  branchPhone?: string | null;
  logoUrl: string | null;
  footerText: string;
}) {
  const footer = footerText.trim();
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-md border border-border/70 bg-white p-3 text-black shadow-sm dark:bg-zinc-50">
      <div className="font-mono text-[11px] leading-[1.45]">
        {logoUrl ? (
          <div className="mb-2 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" className="max-h-10 max-w-[120px] object-contain" />
          </div>
        ) : null}
        <div className="text-center font-bold uppercase tracking-wide">{tenantName || "Nama Toko"}</div>
        {branchName ? (
          <div className="mt-1 flex justify-center">
            <span className="rounded-full border border-black/40 px-2 py-0.5 text-[10px]">{branchName}</span>
          </div>
        ) : null}
        {branchAddress ? (
          <div className="mt-1 text-center text-[10px] leading-snug">{branchAddress}</div>
        ) : null}
        {branchPhone ? <div className="text-center text-[10px]">{branchPhone}</div> : null}

        <Dashed />
        <div className="space-y-1.5 py-0.5">
          <SkelLine w="w-2/3" />
          <SkelLine w="w-1/2" />
          <SkelLine w="w-3/4" />
          <SkelLine w="w-full" />
          <SkelLine w="w-4/5" />
        </div>
        <Dashed />
        <div className="space-y-1.5 py-0.5">
          <SkelRow left="w-16" right="w-14" />
          <SkelRow left="w-14" right="w-10" />
          <SkelRow left="w-12" right="w-16" bold />
          <SkelRow left="w-20" right="w-14" />
        </div>
        <Dashed />
        <div className="flex flex-col items-center gap-1 py-1">
          <div className="h-16 w-16 rounded-sm border border-black/20 bg-black/[0.06] p-1">
            <div className="grid h-full w-full grid-cols-4 gap-0.5">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className={i % 3 === 0 || i === 5 || i === 10 || i === 15 ? "bg-black/30" : "bg-black/10"}
                />
              ))}
            </div>
          </div>
          <SkelLine w="w-20" h="h-2" />
        </div>
        <Dashed />
        <div className="mt-1 text-center text-[10px]">
          {footer ? (
            <span className="whitespace-pre-wrap break-words">{footer}</span>
          ) : (
            <span className="italic text-black/35">(footer nota)</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Dashed() {
  return <div className="my-1.5 border-t border-dashed border-black/40" />;
}

function SkelLine({ w = "w-full", h = "h-2.5" }: { w?: string; h?: string }) {
  return <div className={`mx-auto ${h} ${w} rounded-sm bg-black/10`} />;
}

function SkelRow({ left, right, bold }: { left: string; right: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className={`h-2.5 ${left} rounded-sm ${bold ? "bg-black/20" : "bg-black/10"}`} />
      <div className={`h-2.5 ${right} rounded-sm ${bold ? "bg-black/20" : "bg-black/10"}`} />
    </div>
  );
}
