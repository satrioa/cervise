import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CompactShell } from "@/components/layout/compact-shell";
import { QueryErrorToast } from "@/components/layout/query-error-toast";
import { getTenantAccessRedirect } from "@/lib/auth/authorization";
import {
  getActiveTenant,
  getActiveTenantForBilling,
  TenantAccessError,
} from "@/lib/supabase/actor";
import { surfaceFor } from "@/lib/nav/manifest";

/**
 * Halaman yang tetap boleh dibuka tenant yang langganannya sudah berakhir.
 *
 * Tanpa pengecualian ini, halaman tagihan ikut terkunci: `getActiveTenant()`
 * melempar sebelum halaman dirender, jadi satu-satunya tempat untuk membayar
 * justru tidak bisa dibuka. Tenant yang terkunci lalu terpental ke login
 * tanpa penjelasan, padahal tagihan bisa diselesaikan di halaman yang
 * sama. Itu jalan buntu: tidak ada halaman yang bisa dibuka untuk itu.
 *
 * Daftar ini sengaja pendek dan dibaca per-prefix, bukan "semua
 * /app/pengaturan/*": halaman pengaturan lain (profil, lokalisasi) menyimpan
 * data tenant yang tidak boleh bocor ke akun yang sudah tidak berhak.
 */
const BILLING_EXEMPT_PREFIXES = ["/app/pengaturan/subscription"] as const;

function isBillingExempt(pathname: string | null): boolean {
  if (!pathname) return false;
  // `next-intl` bisa menambah prefiks locale (`/id/...`), jadi Bandingkan
  // setelah locale dihapus supaya daftar di atas tidak perlu dua versi.
  const withoutLocale = pathname.replace(/^\/(?:id|en)(?=\/|$)/i, "");
  return BILLING_EXEMPT_PREFIXES.some(
    (prefix) => withoutLocale === prefix || withoutLocale.startsWith(`${prefix}/`),
  );
}

/**
 * Shell ditentukan oleh manifest, bukan oleh pemeriksaan role di file ini.
 * `surfaceFor()` membaca entri `/app`: kalau entri itu memuat `"compact"`
 * untuk role pengguna, dipakai `CompactShell`; kalau tidak, `AppShell`.
 *
 * Memindahkan keputusannya ke manifest berarti menambah shell ketiga nanti
 * cukup menambah satu nilai di `NAV_ENTRIES`, tanpa menyentuh file ini.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Pathname diteruskan middleware lewat request header. `headers()` dipakai
  // di sini, bukan `usePathname()`, karena layout ini server component.
  const headerList = await headers();
  const pathname = headerList.get("x-pathname");

  const actor = await (isBillingExempt(pathname) ? getActiveTenantForBilling() : getActiveTenant()).catch(
    (error: unknown) => {
      const code = error instanceof TenantAccessError ? error.code : "lookup_failed";
      redirect(getTenantAccessRedirect(code));
    },
  );

  const shellActor = {
    role: actor.role,
    orgId: actor.orgId,
    branchId: actor.branchId,
    fullName: actor.fullName,
    avatarUrl: actor.avatarUrl,
  };

  const shell =
    surfaceFor(actor.role) === "compact" ? (
      <CompactShell actor={shellActor}>{children}</CompactShell>
    ) : (
      <AppShell actor={shellActor}>{children}</AppShell>
    );

  return (
    <>
      {/* useSearchParams butuh Suspense boundary, dan tanpa itu seluruh layout
          ini akan dipaksa jadi dynamic render. Boundary-nya sempit: hanya
          komponen kecil ini, bukan isi halaman. */}
      <Suspense fallback={null}>
        <QueryErrorToast />
      </Suspense>
      {shell}
    </>
  );
}
