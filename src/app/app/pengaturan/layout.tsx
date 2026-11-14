import { getActiveTenant } from "@/lib/supabase/actor";
import { NAV_ENTRIES, normalizeAppRole, type NavEntry, type NavGroup } from "@/lib/nav/manifest";
import {
  SettingsMobileNav,
  SettingsNav,
  SettingsSectionHeader,
  type SettingsNavGroup,
} from "@/components/layout/settings-nav";

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
 *
 * Group `akun` ikut ditampilkan karena di sidebar utama keduanya disembunyikan
 * (lihat `HIDDEN_GROUPS`). Kalau tidak, Lokalisasi tidak punya pintu masuk sama
 * sekali: ikon gear di footer hanya menuju profil.
 */

const GROUP_LABEL: Partial<Record<NavGroup, string>> = {
  akun: "Akun",
  pengaturan: "Pengaturan Tenant",
};

const GROUP_ORDER: NavGroup[] = ["akun", "pengaturan"];

/**
 * Bentuk payload untuk Client Component, dibangun di sini dari `NavEntry`.
 *
 * Dipisah sebagai fungsi murni supaya bisa diuji tanpa `getActiveTenant()`.
 */
export function buildSettingsGroups(entries: NavEntry[]): SettingsNavGroup[] {
  return GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABEL[group],
    entries: entries
      .filter((entry) => entry.group === group)
      .map(({ href, label }) => ({ href, label })),
  })).filter((block) => block.entries.length > 0);
}

export default async function PengaturanLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActiveTenant();
  const role = normalizeAppRole(actor.role);

  const entries = role
    ? NAV_ENTRIES.filter(
        (entry) =>
          entry.surface.includes("legacy") &&
          entry.roles.includes(role) &&
          entry.href.startsWith("/app/pengaturan"),
      )
    : [];

  const groups = buildSettingsGroups(entries);

  // Tidak ada item pengaturan yang boleh dibuka role ini.
  if (groups.length === 0) {
    return <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>;
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-[232px] shrink-0 border-r border-border/60 bg-muted/10 lg:flex flex-col">
        <div className="border-b border-border/50 px-4 py-4">
          <SettingsSectionHeader groups={groups} />
        </div>
        <SettingsNav groups={groups} />
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <div className="lg:hidden border-b border-border/60 bg-muted/10 px-3 py-2 overflow-x-auto scrollbar-none">
          <SettingsMobileNav groups={groups} />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
