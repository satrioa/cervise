import { getActiveTenant } from "@/lib/supabase/actor";
import { surfaceFor } from "@/lib/nav/manifest";
import DashboardOwnerClient from "./dashboard-owner-client";
import { TechnicianDashboard } from "@/components/dashboard/technician-dashboard";
import { FrontlinerDashboard } from "@/components/dashboard/frontliner-dashboard";
import { getHomeData } from "./actions/home";

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

  if (surfaceFor(actor.role) === "compact") {
    // Data dirakit di server dan dikirim sebagai prop, jadi angka pertama
    // sudah ada di HTML pertama - bukan setelah komponen ter-hydrate.
    const home = await getHomeData();
    if (home.kind === "frontliner") {
      return <FrontlinerDashboard fullName={actor.fullName} initialData={home} />;
    }
    return <TechnicianDashboard fullName={actor.fullName} initialData={home} />;
  }

  return <DashboardOwnerClient />;
}
