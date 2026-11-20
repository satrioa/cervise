import { Building2Icon } from "lucide-react";
import { getOwnerDashboard } from "../actions";
import { CreateTenantDialog } from "@/components/owner/create-tenant-dialog";
import { TenantDirectory } from "@/components/owner/tenant-directory";

export default async function OwnerTenantsPage() {
  const { tenants } = await getOwnerDashboard();
  const activeTenants = tenants.filter((tenant) => tenant.status !== "cancelled");
  const archivedTenants = tenants.filter((tenant) => tenant.status === "cancelled");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            <Building2Icon className="size-3.5" /> Tenant management
          </div>
          <h1 className="mt-1 font-heading text-3xl">Tenants</h1>
          <p className="mt-1 text-sm text-muted-foreground">Semua tenant Kaggo yang berada di bawah platform Anda.</p>
        </div>
        <CreateTenantDialog />
      </div>
      <TenantDirectory tenants={activeTenants} archivedTenants={archivedTenants} />
    </div>
  );
}
