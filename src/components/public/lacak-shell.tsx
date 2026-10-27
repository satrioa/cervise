import { PublicBackdrop } from "@/components/public/public-backdrop";
import { LacakForm } from "@/components/public/lacak-form";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { TestimonialsCarousel } from "@/components/public/testimonials-carousel";
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
  children,
}: {
  tenant: PublicTenant;
  /** Pratinjau di Pengaturan hanya menampilkan body, bukan banner + footer. */
  children?: React.ReactNode;
}) {
  const theme = lacakThemeProps(tenant.appearance, resolveLacakScheme(tenant.appearance.mode, false));

  return (
    <main
      className={`lacak-theme ${theme.scheme} flex min-h-svh flex-col`}
      data-palette={theme["data-palette"]}
      data-density={theme["data-density"]}
      suppressHydrationWarning
      data-font={theme["data-font"]}
    >
      {tenant.appearance.mode === "system" ? (
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_MODE_SISTEM }} />
      ) : null}
      <PublicBackdrop />
      {children}
    </main>
  );
}

export function LacakPage({
  tenant,
  initialCode,
  initialResult,
  initialError,
}: {
  tenant: PublicTenant;
  initialCode?: string;
  initialResult?: PublicServisResult | null;
  initialError?: string | null;
}) {
  return (
    <LacakShell tenant={tenant}>
      <PublicHeader
        name={tenant.name}
        logoUrl={tenant.logoUrl}
        bannerUrl={tenant.bannerUrl}
        tagline={tenant.tagline}
        phone={tenant.branchPhone}
      />

      <div className="relative -mt-6 flex-1 rounded-t-3xl border-t bg-background px-4 pb-10 shadow-sm">
        <LacakForm
          tenant={tenant}
          initialCode={initialCode}
          initialResult={initialResult}
          initialError={initialError}
        />
        <TestimonialsCarousel items={tenant.testimonials} />
      </div>

      <PublicFooter
        name={tenant.name}
        instagramUrl={tenant.instagramUrl}
        tiktokUrl={tenant.tiktokUrl}
        address={tenant.branchAddress}
        phone={tenant.branchPhone}
      />
    </LacakShell>
  );
}