import { getActiveTenant } from "@/lib/supabase/actor";
import { surfaceFor } from "@/lib/nav/manifest";
import DashboardOwnerClient from "./dashboard-owner-client";
import { TechnicianDashboard } from "@/components/dashboard/technician-dashboard";

/**
 * Dashboard `/app` untuk dua kelompok pengguna yang sangat berbeda.
 *
 * `MASTER_ADMIN` dan `ADMIN` mendapat dashboard agregat yang sudah ada
 * (kartu statistik + analitik, berorientasi laporan, mudah dibaca manajer).
 * `TECHNICIAN` mendapat dashboard operasional: tugas pribadi, antrean servis
 * yang macet, dan capaian target — bukan angka omzet yang tidak bisa dia
 * kendalikan.
 *
 * Pemilihannya lewat `surfaceFor()`, sama seperti pemilihan shell di
 * `layout.tsx`, supaya tidak ada daftar role yang ditulis dua kali di tempat
 * berbeda.
 */
export default async function DashboardPage() {
  const actor = await getActiveTenant();

  if (surfaceFor(actor.role) === "compact") {
    return <TechnicianDashboard fullName={actor.fullName} />;
  }

  return <DashboardOwnerClient />;
}
