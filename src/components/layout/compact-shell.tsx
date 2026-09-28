"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CommandPaletteProvider, CommandSearchTrigger } from "@/components/layout/command-palette-provider";
import { CompactSidebar } from "@/components/layout/compact-sidebar";
import { BranchProvider } from "@/lib/branch-context";
import { TenantProvider } from "@/lib/tenant-context";
import { LocaleProvider } from "@/lib/localization-context";

/**
 * Shell kedua untuk Cervise, dipakai TEKNICIAN (dan FRONTLINER di Spec 3).
 *
 * Struktur provider-nya sama persis dengan `AppShell` — hanya isi yang
 * berbeda. Itu disengaja: `TenantProvider` dan `BranchProvider` sudah
 * mengunci org dan cabang untuk role non-MASTER_ADMIN, jadi teknisi
 * tidak bisa mengarahkan data ke tenant atau cabang lain.
 *
 * Mobile memakai pola `h-svh` + sheet + bottom tab, bukan grid dua kolom
 * seperti referensi devl, karena Cervise sudah punya navigasi mobile sendiri
 * yang tidak perlu digantikan.
 */

export type CompactShellActor = {
  role: string;
  orgId: string;
  branchId: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

export function CompactShell({ children, actor }: { children: ReactNode; actor: CompactShellActor }) {
  return (
    <LocaleProvider>
      <TenantProvider fixedOrganizationId={actor.orgId}>
        <BranchProvider fixedBranchId={actor.branchId ?? "unassigned"}>
          <CommandPaletteProvider role={actor.role}>
            <CompactShellInner actor={actor}>{children}</CompactShellInner>
          </CommandPaletteProvider>
        </BranchProvider>
      </TenantProvider>
    </LocaleProvider>
  );
}

function CompactShellInner({
  children,
  actor,
}: {
  children: ReactNode;
  actor: CompactShellActor;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background text-foreground lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="hidden h-svh shrink-0 flex-col border-r border-border/60 bg-foreground/[0.02] lg:flex">
        <CompactSidebar
          role={actor.role}
          fullName={actor.fullName}
          avatarUrl={actor.avatarUrl}
        />
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:col-start-2">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 px-3 lg:px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="size-8 lg:hidden" />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[280px] flex-col p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Menu Cervise</SheetTitle>
              </SheetHeader>
              <CompactSidebar
                role={actor.role}
                fullName={actor.fullName}
                avatarUrl={actor.avatarUrl}
                onNavigate={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2 lg:hidden">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
              C
            </span>
            <span className="font-semibold text-sm">Cervise</span>
          </div>

          <div className="ml-auto w-full max-w-sm">
            <CommandSearchTrigger className="w-full" />
          </div>
        </header>

        <main key={pathname} data-main-content className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
