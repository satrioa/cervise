import { navFor, normalizeAppRole, type AppRole, type NavEntry } from "./manifest";

/**
 * Halaman yang tidak pernah muncul sebagai kartu di section "Operasional".
 *
 * - `/app` sudah punya tab sendiri di header shell.
 * - `/app/analitik-servis` adalah tujuan tombol "Lihat Detail" di section
 *   Analytic Servis, bukan kartu. Menampilkannya dua kali di drawer yang sama
 *   membuat satu halaman punya dua pintu dengan label berbeda.
 */
export const COMPACT_MENU_HIDDEN_HREFS: readonly string[] = ["/app", "/app/analitik-servis"];

/**
 * Tiga kartu yang tampil lebih dulu, per role, mengikuti frame Figma.
 *
 * Sisanya ikut di belakang dengan urutan manifest. Daftar ini hanya mengatur
 * URUTAN, bukan hak akses: kalau sebuah entri tidak boleh dibuka role itu,
 * `navFor` sudah membuangnya lebih dulu dan href di sini tidak berefek apa-apa.
 */
const PRIMARY_BY_ROLE: Partial<Record<AppRole, readonly string[]>> = {
  TECHNICIAN: ["/app/servis", "/app/kategori-sparepart", "/app/laporan/servis"],
  FRONTLINER: ["/app/servis", "/app/penjualan", "/app/laporan/servis"],
};

function rank(href: string, primary: readonly string[]): number {
  const index = primary.indexOf(href);
  return index === -1 ? primary.length : index;
}

/**
 * Isi section "Operasional" untuk satu role.
 *
 * Sumbernya `navFor(role, "compact")`, jadi frontliner otomatis mendapat
 * Penjualan/Customer/Transaksi sementara teknisi tidak — tanpa daftar terpisah
 * yang bisa lupa diperbarui saat manifest berubah.
 */
export function operationalEntries(role: string | null | undefined): NavEntry[] {
  const entries = navFor(role, "compact")
    .flatMap((block) => block.entries)
    .filter((entry) => !COMPACT_MENU_HIDDEN_HREFS.includes(entry.href));

  const primary = PRIMARY_BY_ROLE[normalizeAppRole(role) ?? "TECHNICIAN"] ?? [];
  // `sort` stabil, jadi entri non-primary tetap urut manifest.
  return [...entries].sort((a, b) => rank(a.href, primary) - rank(b.href, primary));
}
