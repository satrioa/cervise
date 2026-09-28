import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CompactShell } from "@/components/layout/compact-shell";
import { QueryErrorToast } from "@/components/layout/query-error-toast";
import { getTenantAccessRedirect } from "@/lib/auth/authorization";
import { getActiveTenant, TenantAccessError } from "@/lib/supabase/actor";
import { surfaceFor } from "@/lib/nav/manifest";

/**
 * Shell ditentukan oleh manifest, bukan oleh pemeriksaan role di file ini.
 * `surfaceFor()` membaca entri `/app`: kalau entri itu memuat `"compact"`
 * untuk role pengguna, dipakai `CompactShell`; kalau tidak, `AppShell`.
 *
 * Memindahkan keputusannya ke manifest berarti menambah shell ketiga nanti
 * cukup menambah satu nilai di `NAV_ENTRIES`, tanpa menyentuh file ini.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActiveTenant().catch((error: unknown) => {
    const code = error instanceof TenantAccessError ? error.code : "lookup_failed";
    redirect(getTenantAccessRedirect(code));
  });

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
