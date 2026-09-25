"use client";

import { CerviseAuditLogTable } from "@/components/table-audit-log";
import { useBranch } from "@/lib/branch-context";
import { PageHeader } from "@/components/layout/page-header";

export default function AuditLogPage() {
  const { branch } = useBranch();
  return (
    <div className="bg-background text-foreground">
      <PageHeader
        eyebrow="Layanan · Audit"
        title={
          <span className="inline-flex items-center gap-2">
            Audit Log
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground">
              {branch.label}
            </span>
          </span>
        }
        titleClassName="font-heading text-2xl"
        description="Jejak aktivitas servis, inventory & akses — filter otomatis mengikuti cabang di sidebar."
        actions={
          <div className="text-xs text-muted-foreground font-mono">
            Cabang aktif: <span className="text-foreground font-medium">{branch.label}</span> · {branch.meta}
          </div>
        }
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
        <CerviseAuditLogTable cabangFilter={branch.label} />
      </div>
    </div>
  );
}
