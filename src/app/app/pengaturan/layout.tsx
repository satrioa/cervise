import Link from "next/link";
import { getActiveTenant } from "@/lib/supabase/actor";
import { NAV_ENTRIES, normalizeAppRole, type NavGroup } from "@/lib/nav/manifest";
import { SettingsNav } from "@/components/layout/settings-nav";

/**
 * Sub-sidebar pengaturan.
 *
 * Daftar item di sini dulu ditulis manual dan tidak difilter role sama
 * sekali — FRONTLINER dan TEKNICIAN melihat link Subscription dan Usage, lalu
 * berakhir dengan error dari server action ketika diklik. Sekarang daftar,
 * urutan, dan role yang berhak semuanya datang dari
 * `src/lib/nav/manifest.ts`.
 *
 * Layout ini TIDAK menjadi route guard. Alasannya: `/app/pengaturan/profil`
 * dan `/app/pengaturan/lokalisasi` boleh dibuka semua role, jadi tidak ada satu
 * kunci yang berlaku untuk seluruh subtree. Guard per halaman ada di
 * masing-masing `page.tsx`.
 */

const GROUP_LABEL: Partial<Record<NavGroup, string>> = {
  pengaturan: "Configuration",
};

const GROUP_ORDER: NavGroup[] = ["pengaturan"];

export default async function PengaturanLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActiveTenant();
  const role = normalizeAppRole(actor.role);

  const entries = role
    ? NAV_ENTRIES.filter(
        (entry) =>
          entry.surface.includes("legacy") &&
          entry.roles.includes(role) &&
          entry.href.startsWith("/app/pengaturan") &&
          // Profil dibangun tanpa sub-nav; sidebar kosong kalau ikut.
          !entry.href.endsWith("/profil"),
      )
    : [];

  const groups = GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABEL[group],
    entries: entries.filter((entry) => entry.group === group),
  })).filter((block) => block.entries.length > 0);

  // Role ini tidak punya halaman pengaturan selain profil: jangan tampilkan
  // sidebar yang kosong.
  if (groups.length === 0) {
    return <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>;
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-[220px] shrink-0 border-r border-border/60 bg-muted/20 lg:flex flex-col">
        <div className="p-4">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Pengaturan Sistem</div>
          <p className="mt-1 text-xs text-muted-foreground">Kelola konfigurasi &amp; billing</p>
        </div>
        <SettingsNav groups={groups} />
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <div className="lg:hidden border-b border-border/60 bg-muted/20 px-4 py-2 overflow-x-auto scrollbar-none">
          <div className="flex gap-1">
            {groups.flatMap((block) => block.entries).map((entry) => (
              <Link
                key={entry.href}
                href={entry.href}
                className="whitespace-nowrap rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors"
              >
                {entry.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
