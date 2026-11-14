import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicPhotoUrl } from "@/lib/photos";
import { PageTransition } from "@/components/layout/page-transition";
import { CreateTenantDialog, type TenantCreatePackage } from "@/components/tenant/create-tenant-dialog";
import { TenantSelectTile } from "@/components/tenant/tenant-select-tile";
import { selectTenant } from "./actions";

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
};

const MAX_TENANTS = 5;

function tenantInitial(name: string) {
  const trimmed = name.trim();
  return (trimmed[0] ?? "?").toUpperCase();
}

export default async function TenantSelectorPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard/tenant");

  const [platformAdminResult, employeesResult, packagesResult] = await Promise.all([
    supabase
      .from("platform_admins")
      .select("profile_id")
      .eq("profile_id", auth.user.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("employees")
      .select("organization_id, role")
      .eq("profile_id", auth.user.id)
      .eq("is_active", true),
    supabase
      .from("packages")
      .select("id, code, name, monthly_price, branch_limit")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);
  if (platformAdminResult.error) throw platformAdminResult.error;
  if (employeesResult.error) throw employeesResult.error;
  if (packagesResult.error) throw packagesResult.error;
  if (platformAdminResult.data) redirect("/owner");

  const memberships = (employeesResult.data ?? []) as { organization_id: string; role: string }[];
  const organizationIds = [...new Set(memberships.map((membership) => membership.organization_id).filter(Boolean))];
  if (organizationIds.length === 0) redirect("/onboarding");

  const { data: organizations, error: organizationsError } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url")
    .in("id", organizationIds)
    .order("name");
  if (organizationsError) throw organizationsError;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const packages = (packagesResult.data ?? []) as TenantCreatePackage[];
  const tenantList = (organizations ?? []) as OrganizationRow[];

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12 text-foreground">
      <PageTransition />
      <div className="w-full max-w-3xl">
        <header className="mb-10 text-center">
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Pilih tenant</h1>
          <p className="mt-2 text-sm text-muted-foreground">Masuk ke tenant yang ingin Anda kelola.</p>
        </header>

        <div className="flex flex-wrap justify-center gap-4">
          {tenantList.map((organization) => {
            const logoUrl = publicPhotoUrl(supabaseUrl, organization.logo_url);
            return (
              <TenantSelectTile
                key={organization.id}
                organizationId={organization.id}
                name={organization.name}
                logoUrl={logoUrl}
                initial={tenantInitial(organization.name)}
                action={selectTenant}
              />
            );
          })}

          {organizationIds.length < MAX_TENANTS ? (
            <div className="flex w-32 sm:w-36">
              <CreateTenantDialog packages={packages} asTile />
            </div>
          ) : null}
        </div>

        {organizationIds.length >= MAX_TENANTS ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Batas maksimal {MAX_TENANTS} tenant per akun tercapai.
          </p>
        ) : null}
      </div>
    </main>
  );
}
