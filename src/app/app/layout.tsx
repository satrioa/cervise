import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getTenantAccessRedirect } from "@/lib/auth/authorization";
import { getActiveTenant, TenantAccessError } from "@/lib/supabase/actor";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActiveTenant().catch((error: unknown) => {
    const code = error instanceof TenantAccessError ? error.code : "lookup_failed";
    redirect(getTenantAccessRedirect(code));
  });
  return <AppShell actor={{ role: actor.role, orgId: actor.orgId, branchId: actor.branchId }}>{children}</AppShell>;
}
