import { getActiveTenant } from "@/lib/supabase/actor";
import { NAV_ENTRIES, canAccessActor, normalizeAppRole, type NavEntry, type NavGroup } from "@/lib/nav/manifest";
import { SettingsTabsProvider, type SettingsNavGroup } from "@/components/layout/settings-nav";

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
 * Halaman tagihan tetap bisa dibuka lewat URL/redirect (jalur pemulihan
 * pembayaran), tapi tidak lagi dipajang sebagai menu pengaturan.
 */
const HIDDEN_SETTINGS_HREFS = new Set(["/app/pengaturan/subscription"]);

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
      .filter((entry) => entry.group === group && !HIDDEN_SETTINGS_HREFS.has(entry.href))
      .map(({ href, label }) => ({ href, label })),
  })).filter((block) => block.entries.length > 0);
}

export default async function PengaturanLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActiveTenant();
  const role = normalizeAppRole(actor.role);
  const entries = NAV_ENTRIES.filter(
    (entry) =>
      entry.surface.includes("legacy") &&
      canAccessActor(actor, entry.href) &&
      entry.href.startsWith("/app/pengaturan"),
  );

  const groups = buildSettingsGroups(entries);

  // Tidak ada item pengaturan yang boleh dibuka role ini.
  if (groups.length === 0) {
    return <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>;
  }

  // Master admin (shell legacy) memakai sub-menu horizontal di bawah header.
  // Teknisi/frontliner tetap memakai sidebar/mobile nav yang lama.
  const isCompact = role === "TECHNICIAN" || role === "FRONTLINER";
  if (!isCompact) {
    return (
      <SettingsTabsProvider value={groups}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        </div>
      </SettingsTabsProvider>
    );
  }

  // Teknisi/frontliner membuka pengaturan lewat drawer grid. Sub-sidebar dan
  // nav strip mobile hanya menambah lapis navigasi kedua di shell compact.
  return <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>;
}
