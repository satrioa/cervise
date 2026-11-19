import { createClient } from "@/lib/supabase/server";
import { fetchLoginAccess } from "@/lib/auth/login-access";
import Hero02 from "@/components/originkit/hero-02";
import BentoSection from "@/components/landing/bento-section";
import { FeatureSection } from "@/components/feature-section";
import { LandingSmoothScroll } from "@/components/layout/landing-smooth-scroll";
import { publicPhotoUrl } from "@/lib/photos";
import { PricingThreeTier } from "@/components/pricing-three-tier";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;
  let heroUser: { name: string; email: string; avatarUrl?: string | null } | null = null;
  if (isLoggedIn && user) {
    // `avatar_url` WAJIB ikut diselect. Tanpa kolom ini, `heroUser.avatarUrl`
    // selalu `undefined`, sehingga navbar selalu jatuh ke nilai cadangan dan
    // foto profil asli tidak pernah muncul di landing page padahal sudah
    // tersimpan di database.
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    const name = (profile as { full_name?: string | null } | null)?.full_name ?? (user.user_metadata as { full_name?: string } | null)?.full_name ?? user.email?.split("@")[0] ?? "Akun";
    const email = (profile as { email?: string | null } | null)?.email ?? user.email ?? "";
    // `publicPhotoUrl` menolak path yang tidak aman, jadi kolom yang berisi
    // "../" atau URL luar tidak bisa dialihkan ke host lain. Pola ini sama
    // dengan `lib/supabase/actor.ts`.
    const avatarUrl = publicPhotoUrl(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      (profile as { avatar_url?: string | null } | null)?.avatar_url,
    );
    heroUser = { name, email, avatarUrl };
  }

  // Master admin dengan lebih dari satu tenant aktif: Dashboard diarahkan ke
  // pemilih tenant (/dashboard/tenant) seperti perilaku login multi-tenant.
  // Satu tenant (atau non-admin) tetap /app.
  let dashboardHref = "/app";
  if (isLoggedIn && user) {
    try {
      const access = await fetchLoginAccess(supabase);
      const isManagerWithMultipleTenants =
        !access.isPlatformAdmin &&
        access.profileActive &&
        access.activeMemberships.length > 1 &&
        access.activeMemberships.some(
          (membership) => membership.role.toUpperCase() === "MASTER_ADMIN",
        );
      if (isManagerWithMultipleTenants) dashboardHref = "/dashboard/tenant";
    } catch {
      // Default /app; gateway tetap menangani akses di /app.
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <LandingSmoothScroll />
      <Hero02 isLoggedIn={isLoggedIn} user={heroUser} dashboardHref={dashboardHref} />

      <BentoSection />

      <section id="fitur" className="border-t bg-muted/20 px-4 py-16 lg:px-8">
        <FeatureSection />
      </section>

      <section id="harga">
        <PricingThreeTier />
      </section>

      <footer className="border-t px-4 py-6 text-center text-sm text-muted-foreground lg:px-8">
        © 2026 Kaggo • Manajemen Servis Gadget Multibranch • Dibuat ringan untuk Frontliner & Teknisi di HP
      </footer>
    </div>
  );
}
