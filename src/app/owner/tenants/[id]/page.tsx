import Link from "next/link";
import { ArrowLeftIcon, Building2Icon, CreditCardIcon, MapPinIcon, UsersIcon } from "lucide-react";
import { getPackages, getTenantDetail } from "../../actions";
import { formatRupiah } from "@/lib/format";
import { resolveSubscriptionAccessState, type SubscriptionLifecycleStatus } from "@/lib/billing/renewal";
import { InvoiceReviewTable } from "@/components/owner/invoice-review-table";
import { ExtendSubscription } from "@/components/owner/extend-subscription";
import { SubscriptionForm } from "@/components/owner/subscription-form";
import { EmployeeActiveToggle } from "@/components/owner/employee-active-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value)) : "—";
}

function statusVariant(status: string) {
  if (status === "active") return "success" as const;
  if (status === "trial") return "info" as const;
  if (status === "grace") return "warning" as const;
  if (status === "blocked" || status === "cancelled") return "destructive" as const;
  return "outline" as const;
}

function resolveAccessState(
  subscription: { status: string; trial_ends_at: string | null; current_period_end: string | null; grace_days: number } | null,
  now: Date,
): SubscriptionLifecycleStatus {
  if (!subscription) return "blocked";
  return resolveSubscriptionAccessState({
    status: subscription.status as SubscriptionLifecycleStatus,
    currentPeriodEnd: subscription.current_period_end,
    trialEndsAt: subscription.trial_ends_at,
    graceDays: subscription.grace_days,
    now,
  });
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, packages] = await Promise.all([getTenantDetail(id), getPackages()]);
  const organization = detail.organization as { id: string; name: string; slug: string; status: string; owner_email: string | null; owner_phone: string | null; contact_phone: string | null };
  const subscription = detail.subscription as { package_id: string; custom_monthly_price: number | null; grace_days: number; status: string; current_period_start: string | null; current_period_end: string | null; trial_ends_at: string | null; package: { name: string; branch_limit: number; monthly_price: number } } | null;
  const branches = detail.branches as { id: string; name: string; city: string | null; phone: string | null; is_active: boolean }[];
  const employees = detail.employees as { id: string; profile_id: string; role: string; is_active: boolean; branch_id: string }[];
  const invoices = detail.invoices as { id: string; invoice_number: string; invoice_type: string; status: string; amount: number; period_start: string; period_end: string; due_date: string; whatsapp_sent_at: string | null; decision_note: string | null; organization: { id: string; name: string } | null; package: { name: string } | null; currentPackageName: string | null; currentPackagePrice: number | null }[];

  const now = new Date();
  const accessState = resolveAccessState(subscription, now);
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const graceEndsAt = periodEnd ? addDays(periodEnd, subscription?.grace_days ?? 0) : null;
  const isMismatch = subscription !== null && subscription.status !== accessState && !(subscription.status === "active" && accessState === "grace") && !(subscription.status === "grace" && accessState === "grace");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/owner/tenants"><ArrowLeftIcon className="size-4" /> Kembali ke tenants</Link>
      </Button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"><Building2Icon className="size-3.5" /> Tenant detail</div>
          <h1 className="mt-1 font-heading text-3xl">{organization.name}</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{organization.slug} · {organization.owner_email ?? "tanpa email"}</p>
        </div>
        <Badge variant={statusVariant(organization.status)} className="w-fit">{organization.status}</Badge>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Subscription</CardTitle>
              <CardDescription>Status di bawah dihitung dari periode + grace, bukan hanya kolom status.</CardDescription>
            </div>
            <ExtendSubscription
              organizationId={organization.id}
              subscription={subscription}
              packages={packages.map((item) => ({ id: item.id, name: item.name, monthly_price: item.monthly_price, branch_limit: item.branch_limit }))}
            />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(accessState)}>Akses: {accessState}</Badge>
              {isMismatch ? <Badge variant="warning">DB: {subscription?.status}</Badge> : null}
              {accessState === "blocked" ? <span className="text-xs text-destructive">Akses tenant terblokir meskipun status tersimpan bisa berbeda.</span> : null}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div><div className="text-xs text-muted-foreground">Paket</div><div className="mt-1 font-medium">{subscription?.package.name ?? "—"}</div></div>
              <div><div className="text-xs text-muted-foreground">Harga / bulan</div><div className="mt-1 font-medium">{formatRupiah(subscription?.custom_monthly_price ?? subscription?.package.monthly_price ?? 0)}</div></div>
              <div><div className="text-xs text-muted-foreground">{subscription?.status === "trial" ? "Trial berakhir" : "Akses s/d"}</div><div className="mt-1 font-medium">{formatDate(subscription?.status === "trial" ? subscription.trial_ends_at : subscription?.current_period_end ?? null)}</div></div>
              <div><div className="text-xs text-muted-foreground">Periode mulai</div><div className="mt-1 font-medium">{formatDate(subscription?.current_period_start ?? null)}</div></div>
              <div><div className="text-xs text-muted-foreground">Grace berakhir</div><div className="mt-1 font-medium">{graceEndsAt ? formatDate(graceEndsAt.toISOString()) : "—"}</div></div>
              <div><div className="text-xs text-muted-foreground">Grace days</div><div className="mt-1 font-medium">{subscription?.grace_days ?? "—"}</div></div>
            </div>
            <div className="mt-5 border-t pt-5">
              <SubscriptionForm organizationId={organization.id} subscription={subscription} packages={packages.map((item) => ({ id: item.id, name: item.name, monthly_price: item.monthly_price, branch_limit: item.branch_limit }))} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Kontak & branch</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><UsersIcon className="size-4 text-muted-foreground" />{organization.owner_email ?? "—"}</div>
            <div className="flex items-center gap-2"><MapPinIcon className="size-4 text-muted-foreground" />{organization.contact_phone ?? organization.owner_phone ?? "—"}</div>
            <div className="flex items-center gap-2"><CreditCardIcon className="size-4 text-muted-foreground" />{branches.filter((branch) => branch.is_active).length} branch aktif · {employees.filter((employee) => employee.is_active).length} staff</div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Branches</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Kota</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell>{branch.city ?? "—"}</TableCell>
                    <TableCell><Badge variant={branch.is_active ? "success" : "outline"}>{branch.is_active ? "aktif" : "nonaktif"}</Badge></TableCell>
                  </TableRow>
                ))}
                {branches.length === 0 ? <TableRow><TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">Belum ada branch.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Employees</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Cabang</TableHead><TableHead>Aktif</TableHead></TableRow></TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.role}</TableCell>
                    <TableCell className="font-mono text-xs">{employee.branch_id.slice(0, 8)}</TableCell>
                    <TableCell><EmployeeActiveToggle employeeId={employee.id} active={employee.is_active} /></TableCell>
                  </TableRow>
                ))}
                {employees.length === 0 ? <TableRow><TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">Belum ada staff.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Invoice</CardTitle><CardDescription>Reminder renewal dibuat otomatis H-7; approve hanya untuk pembayaran yang belum dicover perpanjangan manual.</CardDescription></CardHeader>
        <CardContent><InvoiceReviewTable invoices={invoices} /></CardContent>
      </Card>
    </div>
  );
}
