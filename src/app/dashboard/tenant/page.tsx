import { Building2Icon, CheckCircle2Icon, MapPinIcon, PackageIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { selectTenant } from "./actions";

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
};

type SubscriptionRow = {
  organization_id: string;
  status: string;
  package: { name: string } | { name: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function statusVariant(status: string | undefined) {
  if (status === "active") return "success" as const;
  if (status === "trial") return "info" as const;
  if (status === "grace") return "warning" as const;
  return "outline" as const;
}

function statusLabel(status: string | undefined) {
  if (status === "active") return "Aktif";
  if (status === "trial") return "Trial";
  if (status === "grace") return "Grace";
  if (status === "blocked" || status === "suspended") return "Dibatasi";
  if (status === "cancelled") return "Dibatalkan";
  return "Status tidak tersedia";
}

export default async function TenantSelectorPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard/tenant");

  const [platformAdminResult, employeesResult] = await Promise.all([
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
  ]);
  if (platformAdminResult.error) throw platformAdminResult.error;
  if (employeesResult.error) throw employeesResult.error;
  if (platformAdminResult.data) redirect("/owner");

  const memberships = (employeesResult.data ?? []) as { organization_id: string; role: string }[];
  const organizationIds = [...new Set(memberships.map((membership) => membership.organization_id).filter(Boolean))];
  if (organizationIds.length === 0) redirect("/onboarding");

  const [organizationsResult, branchesResult, subscriptionsResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug")
      .in("id", organizationIds)
      .order("name"),
    supabase
      .from("branches")
      .select("organization_id, is_active")
      .in("organization_id", organizationIds)
      .eq("is_active", true),
    supabase
      .from("tenant_subscriptions")
      .select("organization_id, status, package:packages!inner(name)")
      .in("organization_id", organizationIds),
  ]);
  if (organizationsResult.error) throw organizationsResult.error;
  if (branchesResult.error) throw branchesResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;

  const branchCounts = new Map<string, number>();
  for (const branch of (branchesResult.data ?? []) as { organization_id: string; is_active: boolean }[]) {
    if (branch.is_active) branchCounts.set(branch.organization_id, (branchCounts.get(branch.organization_id) ?? 0) + 1);
  }
  const subscriptions = new Map(
    ((subscriptionsResult.data ?? []) as SubscriptionRow[]).map((subscription) => [
      subscription.organization_id,
      {
        status: subscription.status,
        packageName: firstRelation(subscription.package)?.name ?? null,
      },
    ]),
  );

  return <main className="min-h-svh bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8"><div className="mx-auto max-w-3xl"><header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"><Building2Icon className="size-3.5" /> Tenant access</div><h1 className="mt-2 font-heading text-3xl">Pilih tenant</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Pilih tenant yang ingin Anda buka. Pilihan ini disimpan di browser ini dan tidak akan diminta lagi selama tenant tersebut masih aktif.</p></div><Badge variant="outline" size="lg">{organizationIds.length} tenant tersedia</Badge></header><div className="flex flex-col gap-3">{((organizationsResult.data ?? []) as OrganizationRow[]).map((organization) => { const subscription = subscriptions.get(organization.id); const branchCount = branchCounts.get(organization.id) ?? 0; return <Card key={organization.id} className="transition-colors hover:bg-muted/20"><CardHeader><div className="flex items-start gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border bg-muted font-heading text-lg font-semibold">{organization.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-base">{organization.name}</CardTitle><Badge size="sm" variant={statusVariant(subscription?.status)}>{statusLabel(subscription?.status)}</Badge></div><CardDescription className="mt-1 font-mono text-xs">{organization.slug}</CardDescription></div></div></CardHeader><CardContent><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><PackageIcon className="size-3.5" />{subscription?.packageName ?? "Paket belum tersedia"}</span><span className="inline-flex items-center gap-1.5"><MapPinIcon className="size-3.5" />{branchCount} cabang</span>{subscription?.status === "active" ? <span className="inline-flex items-center gap-1.5 text-success-foreground"><CheckCircle2Icon className="size-3.5" />Akses siap</span> : null}</div><form action={selectTenant}><input type="hidden" name="organizationId" value={organization.id} /><Button type="submit" size="sm">Masuk ke tenant</Button></form></div></CardContent></Card>; })}</div></div></main>;
}
