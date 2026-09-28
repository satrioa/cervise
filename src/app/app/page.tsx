import { getActiveTenant } from "@/lib/supabase/actor";
import { normalizeAppRole, surfaceFor } from "@/lib/nav/manifest";
import DashboardOwnerClient from "./dashboard-owner-client";
import { TechnicianDashboard } from "@/components/dashboard/technician-dashboard";
import { FrontlinerDashboard } from "@/components/dashboard/frontliner-dashboard";

/**
 * Dashboard `/app` untuk tiga kelompok pengguna yang sangat berbeda.
 *
 * `MASTER_ADMIN` dan `ADMIN` mendapat dashboard agregat yang sudah ada (kartu
 * statistik + analitik, berorientasi laporan, mudah dibaca manajer).
 * `TECHNICIAN` mendapat dashboard operasional: tugas pribadi, antrean servis
 * yang macet, dan capaian target. `FRONTLINER` mendapat dashboard kas: antrean
 * pembayaran, transaksi manual, dan tombol Tutup Toko.
 *
 * Ketiganya memakai kerangka yang sama dan shell compact, tapi isinya tidak
 * ada yang sama — itu memang tujuannya.
 *
 * Pemilihannya lewat `surfaceFor()` dan `normalizeAppRole()`, sama seperti
 * pemilihan shell di `layout.tsx`, supaya tidak ada daftar role yang ditulis
 * dua kali di tempat berbeda.
 */
export default async function DashboardPage() {
  const actor = await getActiveTenant();
  const role = normalizeAppRole(actor.role);

  if (surfaceFor(actor.role) === "compact") {
    if (role === "FRONTLINER") {
      return <FrontlinerDashboard fullName={actor.fullName} />;
    }
    return <TechnicianDashboard fullName={actor.fullName} />;
  }

  return <DashboardOwnerClient />;
}
