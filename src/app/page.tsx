import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Users, BarChart3, Wallet, UserCog, LayoutDashboard, Store, Smartphone, ShieldCheck, Zap } from "lucide-react";

const btnPrimary = "inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90";
const btnOutline = "inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted";
const btnGhostSm = "inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-sm font-medium hover:bg-muted";
const btnSm = "inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90";

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur lg:px-8">
        <div className="flex items-center gap-2 font-bold text-lg">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">C</span>
          Cervise
          <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">Multibranch</Badge>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#fitur" className="hover:text-foreground">Fitur</a>
          <a href="#harga" className="hover:text-foreground">Harga</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className={btnGhostSm}>Masuk</Link>
          <Link href="/app" className={btnSm}>Coba Gratis 14 Hari</Link>
        </div>
      </header>

      <section className="px-4 py-12 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-6xl grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <Badge className="mb-3">Baru • PWA Ringan untuk Teknisi di HP</Badge>
            <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">
              Kelola servis gadget <span className="text-muted-foreground">multi-cabang</span> tanpa ribet.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Cervise bantu Frontliner catat servis, Teknisi update status, Admin pantau keuangan & laporan — 1 user 1 cabang, aman tidak bocor antar cabang. Garansi 3 bulan otomatis.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/app" className={btnPrimary}>Mulai Trial Gratis</Link>
              <Link href="#harga" className={btnOutline}>Lihat Harga</Link>
            </div>
            <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Zap className="size-4" /> Ringan di HP kentang</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="size-4" /> Isolasi per cabang</span>
            </div>
          </div>
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2"><Store className="size-5" /> Cervise App Preview</CardTitle>
              <CardDescription>Workspace rail di desktop, bottom nav di mobile.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid min-h-[280px] grid-cols-[160px_1fr] gap-2 rounded-lg border bg-muted/30 p-2 text-xs">
                <div className="rounded bg-background border p-2 space-y-2">
                  <div className="font-semibold">Cervise Pusat</div>
                  <div className="space-y-1 text-muted-foreground">
                    <div className="bg-foreground/5 rounded px-2 py-1 text-foreground">Dashboard</div>
                    <div className="px-2 py-1">Servis • 12</div>
                    <div className="px-2 py-1">Customer</div>
                    <div className="px-2 py-1">Keuangan</div>
                  </div>
                </div>
                <div className="rounded bg-background border p-3">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Hari ini</div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="rounded border p-2"><div className="text-lg font-bold">24</div><div className="text-muted-foreground">Servis Masuk</div></div>
                    <div className="rounded border p-2"><div className="text-lg font-bold">Rp 4,2jt</div><div className="text-muted-foreground">Omzet</div></div>
                    <div className="rounded border p-2"><div className="text-lg font-bold">8</div><div className="text-muted-foreground">Garansi Aktif</div></div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded bg-amber-50 border border-amber-200 px-2 py-1.5 text-amber-900 dark:bg-amber-950/20">
                    <Smartphone className="size-3.5" /> Dioptimalkan untuk Frontliner & Teknisi di HP
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

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

      <section id="harga" className="px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold">Harga Simpel</h2>
          <p className="text-muted-foreground">Trial 14 hari gratis. Konfirmasi transfer manual via WhatsApp.</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Trial</CardTitle>
                <CardDescription>14 Hari Gratis</CardDescription>
                <div className="pt-2 text-3xl font-bold">Rp 0</div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <div>✓ 1 cabang, 3 user</div>
                <div>✓ Semua fitur</div>
                <div>✓ Garansi 3 bulan</div>
                <Link href="/app" className={`${btnOutline} mt-4 w-full`}>Mulai Trial</Link>
              </CardContent>
            </Card>
            <Card className="border-primary shadow-lg">
              <CardHeader>
                <Badge className="w-fit">Paling Laris</Badge>
                <CardTitle className="mt-1">Basic</CardTitle>
                <CardDescription>Untuk 1 toko</CardDescription>
                <div className="pt-2 text-3xl font-bold">Rp 199rb <span className="text-sm font-normal text-muted-foreground">/bulan</span></div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <div>✓ 1 cabang, 3 user</div>
                <div>✓ Kas & Laporan</div>
                <div>✓ Notifikasi WA Fonnte</div>
                <Link href="https://wa.me/6280000000000" className={`${btnPrimary} mt-4 w-full`}>Hubungi WA</Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pro</CardTitle>
                <CardDescription>Untuk multi-cabang</CardDescription>
                <div className="pt-2 text-3xl font-bold">Rp 499rb <span className="text-sm font-normal text-muted-foreground">/bulan</span></div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <div>✓ 3 cabang, 15 user</div>
                <div>✓ Rekap konsolidasi owner</div>
                <div>✓ Prioritas support</div>
                <Link href="https://wa.me/6280000000000" className={`${btnOutline} mt-4 w-full`}>Hubungi WA</Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <footer className="border-t px-4 py-6 text-center text-sm text-muted-foreground lg:px-8">
        © 2026 Cervise • Manajemen Servis Gadget Multibranch • Dibuat ringan untuk Frontliner & Teknisi di HP
      </footer>
    </div>
  );
}
