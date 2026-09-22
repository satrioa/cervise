"use client";

import { CerviseAuditLogTable } from "@/components/table-audit-log";
import { useBranch } from "@/lib/branch-context";

export default function AuditLogPage() {
  const { branch } = useBranch();
  return (
    <div className="bg-background text-foreground">
      <div className="border-b border-border/60 px-4 sm:px-6 lg:px-10 py-6">
        <div className="mx-auto max-w-6xl flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Layanan · Audit</div>
            <h1 className="mt-1 font-heading text-2xl flex items-center gap-2">
              Audit Log
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {branch.label}
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Jejak aktivitas servis, inventory & akses — filter otomatis mengikuti cabang di sidebar.
            </p>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            Cabang aktif: <span className="text-foreground font-medium">{branch.label}</span> · {branch.meta}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
        <CerviseAuditLogTable cabangFilter={branch.label} />
      </div>
    </div>
  );
}
