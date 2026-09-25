import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wrench, Users, BarChart3, Wallet, UserCog, LayoutDashboard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Hero02 from "@/components/originkit/hero-02";
import { PricingThreeTier } from "@/components/pricing-three-tier";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;
  let heroUser: { name: string; email: string; avatarUrl?: string | null } | null = null;
  if (isLoggedIn && user) {
    const { data: profile } = await supabase.from("profiles").select("full_name, email, phone").eq("id", user.id).maybeSingle();
    const name = (profile as { full_name?: string | null } | null)?.full_name ?? (user.user_metadata as { full_name?: string } | null)?.full_name ?? user.email?.split("@")[0] ?? "Akun";
    const email = (profile as { email?: string | null } | null)?.email ?? user.email ?? "";
    heroUser = { name, email };
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Hero02 isLoggedIn={isLoggedIn} user={heroUser} />

      <section id="fitur" className="border-t bg-muted/20 px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold">6 Menu Utama</h2>
          <p className="text-muted-foreground">Semua operasional toko gadget dalam satu aplikasi.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: LayoutDashboard, title: "Dashboard Overview", desc: "Omzet, servis pending, workload teknisi per cabang." },
              { icon: Wrench, title: "Servis", desc: "7 status: Masuk → Diagnosa → Menunggu Konfirmasi → Sparepart → Dikerjakan → Selesai → Diambil. Garansi 3 bulan." },
              { icon: Users, title: "Data Customer", desc: "Riwayat servis per customer, notifikasi WA Fonnte otomatis." },
              { icon: UserCog, title: "Data Karyawan", desc: "Master-admin, Admin, Frontliner, Teknisi - 1 user 1 cabang." },
              { icon: Wallet, title: "Keuangan", desc: "Kas harian, tutup kas, pemasukan & pengeluaran terpisah per cabang." },
              { icon: BarChart3, title: "Laporan", desc: "Export Excel/PDF rentang tanggal, filter per teknisi & cabang." },
            ].map((f) => (
              <Card key={f.title}>
                <CardHeader>
                  <f.icon className="size-5" />
                  <CardTitle className="text-base">{f.title}</CardTitle>
                  <CardDescription>{f.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="harga">
        <PricingThreeTier />
      </section>

      <footer className="border-t px-4 py-6 text-center text-sm text-muted-foreground lg:px-8">
        © 2026 Cervise • Manajemen Servis Gadget Multibranch • Dibuat ringan untuk Frontliner & Teknisi di HP
      </footer>
    </div>
  );
}
