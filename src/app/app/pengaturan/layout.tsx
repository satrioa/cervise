"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    label: "Configuration",
    items: [
      { label: "General", href: "/app/pengaturan" },
      { label: "Kategori Sparepart", href: "/app/pengaturan/kategori-sparepart" },
      { label: "Tampilan", href: "/app/pengaturan/tampilan" },
      { label: "Lokalisasi", href: "/app/pengaturan/lokalisasi" },
    ],
  },
  {
    label: "Billing",
    items: [
      { label: "Subscription", href: "/app/pengaturan/subscription" },
      { label: "Usage", href: "/app/pengaturan/usage" },
    ],
  },
];

export default function PengaturanLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isProfil = pathname === "/app/pengaturan/profil" || pathname.startsWith("/app/pengaturan/profil/");

  if (isProfil) {
    return <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>;
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* Sub sidebar - desktop */}
      <aside className="hidden w-[220px] shrink-0 border-r border-border/60 bg-muted/20 lg:flex flex-col">
        <div className="p-4">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Pengaturan Sistem</div>
          <p className="mt-1 text-xs text-muted-foreground">Kelola konfigurasi & billing</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {GROUPS.map((group) => (
            <div key={group.label} className="mt-4 first:mt-2">
              <div className="px-2 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">{group.label}</div>
              <ul className="mt-1 flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || (item.href !== "/app/pengaturan" && pathname.startsWith(item.href));
                  // General is exact /app/pengaturan
                  const isGeneralActive = item.href === "/app/pengaturan" && pathname === "/app/pengaturan";
                  const isActive = item.href === "/app/pengaturan" ? isGeneralActive : active;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex w-full rounded-md px-2 py-1.5 text-sm transition-colors",
                          isActive ? "bg-foreground/[0.06] font-medium text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile sub nav - horizontal scroll */}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="lg:hidden border-b border-border/60 bg-muted/20 px-4 py-2 overflow-x-auto scrollbar-none">
          <div className="flex gap-1">
            {GROUPS.flatMap((g) => g.items).map((item) => {
              const isActive = pathname === item.href || (item.href !== "/app/pengaturan" && pathname.startsWith(item.href));
              const isGeneralActive = item.href === "/app/pengaturan" && pathname === "/app/pengaturan";
              const active = item.href === "/app/pengaturan" ? isGeneralActive : isActive;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors",
                    active ? "bg-foreground text-background" : "bg-background border text-muted-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
