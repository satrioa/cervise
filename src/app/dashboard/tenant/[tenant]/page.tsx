import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getTenantAccessRedirect } from "@/lib/auth/authorization";
import { getTenantBySlugForCurrentUser, TenantAccessError } from "@/lib/supabase/actor";
import { selectTenant } from "../actions";

export default async function TenantDashboardPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { organization } = await getTenantBySlugForCurrentUser(slug).catch((error: unknown) => {
    if (error instanceof TenantAccessError) redirect(getTenantAccessRedirect(error.code));
    throw error;
  });

  return <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12"><form action={selectTenant} className="rounded-xl border bg-card p-6 text-center"><h1 className="font-heading text-xl">Buka {organization.name}</h1><p className="mt-2 text-sm text-muted-foreground">Simpan tenant ini sebagai tenant terakhir yang dibuka.</p><input type="hidden" name="organizationId" value={organization.id} /><Button type="submit" className="mt-4">Lanjutkan</Button></form></main>;
}
