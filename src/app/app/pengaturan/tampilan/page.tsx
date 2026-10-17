import { requireMenu } from "@/lib/auth/require-menu";
import { getActiveTenant } from "@/lib/supabase/actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsAppearanceShowcasePage } from "@/components/settings-appearance";
import { toPublicTenant, type LandingRow, type PublicTenant } from "@/lib/public/landing";

export default async function TampilanPage() {
  // Pengaturan di sini milik toko, bukan milik satu pengguna: halaman Lacak
  // dibaca pengunjung tanpa sesi, jadi penampilannya harus sama untuk semua.
  // Hanya MASTER_ADMIN yang boleh mengubahnya.
  await requireMenu("pengaturan_tampilan");
  const actor = await getActiveTenant();

  // Sama seperti `updateBrand`, `organizations` di-revoke dari `authenticated`,
  // jadi satu-satunya jalur baca-tulis adalah service role.
  const { data } = await createAdminClient()
    .from("organizations")
    .select(
      "name, slug, logo_url, banner_url, tagline, instagram_url, tiktok_url, lacak_appearance, branches(id, name, city, phone, is_active, created_at), lacak_testimonials(id, nama, isi, rating, urutan, is_active, created_at)",
    )
    .eq("id", actor.orgId ?? "")
    .maybeSingle();

  const tenant: PublicTenant = toPublicTenant(
    (data ?? {
      name: "",
      slug: "",
      logo_url: null,
      banner_url: null,
      tagline: null,
      instagram_url: null,
      tiktok_url: null,
      lacak_appearance: undefined,
      branches: null,
      lacak_testimonials: null,
    }) as LandingRow,
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  );

  return <SettingsAppearanceShowcasePage initial={tenant.appearance} tenant={tenant} />;
}