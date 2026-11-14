import { PublicBackdrop } from "@/components/public/public-backdrop";
import { LacakForm } from "@/components/public/lacak-form";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { PublicTopNav } from "@/components/public/public-top-nav";
import type { PublicTenant } from "@/lib/public/landing";
import type { PublicServisResult } from "@/lib/public/lookup";
import { lacakThemeProps, resolveLacakScheme } from "@/lib/operational/lacak-appearance";

/**
 * Mode `system` tidak bisa diputuskan di server: `prefers-color-scheme` bukan
 * header yang dikirim browser, jadi satu-satunya sumbernya `matchMedia` di
 * sisi klien. Skrip ini sinkron dan diletakkan sebelum isi, sehingga tidak ada
 * kilat tema yang salah.
 *
 * String-nya statis dan tidak pernah berisi nilai appearance: pilihan admin
 * sudah masuk lewat atribut `data-*` di elemen yang sama.
 */
const SCRIPT_MODE_SISTEM = `(function(){try{var e=document.currentScript.closest(".lacak-theme");if(e&&window.matchMedia("(prefers-color-scheme: dark)").matches){e.classList.remove("lacak-light");e.classList.add("lacak-dark");}}catch(t){}})();`;

/**
 * Kerangka halaman Lacak: banner, body, testimoni, footer.
 *
 * Pilihan admin masuk lewat atribut `data-*` yang nilainya sudah dibatasi
 * daftar di `lacak-appearance.ts`, bukan lewat `style`. Dengan begitu tidak
 * ada string CSS yang dirakit dari data, dan `--font-sans` milik aplikasi
 * pada `<html>` tidak tersentuh: penampannya hanya di dalam elemen ini.
 */
export function LacakShell({
  tenant,
  appearance = tenant.appearance,
  children,
}: {
  tenant: PublicTenant;
  /** Pengaturan yang belum disimpan (pratinjau) dipakai menggantikan milik tenant. */
  appearance?: PublicTenant["appearance"];
  children?: React.ReactNode;
}) {
  const theme = lacakThemeProps(appearance, resolveLacakScheme(appearance.mode, false));

  return (
    <main
      className={`lacak-theme ${theme.scheme} flex min-h-svh flex-col`}
      data-palette={theme["data-palette"]}
      data-density={theme["data-density"]}
      suppressHydrationWarning
      data-font={theme["data-font"]}
    >
      {appearance.mode === "system" ? (
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_MODE_SISTEM }} />
      ) : null}
      <PublicBackdrop />
      {children}
    </main>
  );
}

export function LacakPage({
  tenant,
  appearance,
  initialCode,
  initialResult,
  initialError,
}: {
  tenant: PublicTenant;
  /** Pengaturan yang belum disimpan (pratinjau) dipakai menggantikan milik tenant. */
  appearance?: PublicTenant["appearance"];
  initialCode?: string;
  initialResult?: PublicServisResult | null;
  initialError?: string | null;
}) {
  return (
    <LacakShell tenant={tenant} appearance={appearance}>
      <PublicTopNav name={tenant.name} logoUrl={tenant.logoUrl} phone={tenant.branchPhone} />

      <PublicHeader bannerUrls={tenant.bannerUrls} tagline={tenant.tagline} />

      <div className="relative flex-1 rounded-t-3xl border-t bg-background px-4 pb-10 shadow-sm">
        <LacakForm
          tenant={tenant}
          initialCode={initialCode}
          initialResult={initialResult}
          initialError={initialError}
        />
      </div>

      <PublicFooter
        name={tenant.name}
        instagramUrl={tenant.instagramUrl}
        tiktokUrl={tenant.tiktokUrl}
        websiteUrl={tenant.websiteUrl}
        facebookUrl={tenant.facebookUrl}
        xUrl={tenant.xUrl}
        youtubeUrl={tenant.youtubeUrl}
        whatsappUrl={tenant.whatsappUrl}
        mapsUrl={tenant.mapsUrl}
        footerNote={tenant.footerNote}
        address={tenant.branchAddress}
        phone={tenant.branchPhone}
      />
    </LacakShell>
  );
}