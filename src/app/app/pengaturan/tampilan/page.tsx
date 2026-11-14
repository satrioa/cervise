import { requireMenu } from "@/lib/auth/require-menu";
import { getActiveTenant } from "@/lib/supabase/actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { StoreAppearancePage } from "@/components/settings-appearance";
import { toPublicTenant, type LandingRow, type PublicTenant } from "@/lib/public/landing";

export default async function TampilanStorePage() {
  // Pengaturan tampilan Store/Lacak milik toko (publik) — hanya MASTER_ADMIN.
  await requireMenu("pengaturan_tampilan");
  const actor = await getActiveTenant();

  const { data } = await createAdminClient()
    .from("organizations")
    .select(
      "name, slug, logo_url, banner_urls, tagline, instagram_url, tiktok_url, website_url, facebook_url, x_url, youtube_url, whatsapp_url, maps_url, footer_note, receipt_logo_url, receipt_footer_text, lacak_appearance, branches(id, name, city, phone, is_active, created_at)",
    )
    .eq("id", actor.orgId ?? "")
    .maybeSingle();

  const tenant: PublicTenant = toPublicTenant(
    (data ?? {
      name: "",
      slug: "",
      logo_url: null,
      banner_urls: [],
      tagline: null,
      instagram_url: null,
      tiktok_url: null,
      website_url: null,
      facebook_url: null,
      x_url: null,
      youtube_url: null,
      whatsapp_url: null,
      maps_url: null,
      footer_note: null,
      receipt_logo_url: null,
      receipt_footer_text: null,
      lacak_appearance: undefined,
      branches: null,
    }) as LandingRow,
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  );

  return <StoreAppearancePage initial={tenant.appearance} tenant={tenant} />;
}