import Link from "next/link";
import { ArrowLeftIcon, Building2Icon, CreditCardIcon, MapPinIcon, UsersIcon } from "lucide-react";
import { getPackages, getTenantDetail } from "../../actions";
import { InvoiceReviewTable } from "@/components/owner/invoice-review-table";
import { SubscriptionForm } from "@/components/owner/subscription-form";
import { EmployeeActiveToggle } from "@/components/owner/employee-active-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatRupiah(value: number) {
  return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
}

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

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, packages] = await Promise.all([getTenantDetail(id), getPackages()]);
  const organization = detail.organization as { id: string; name: string; slug: string; status: string; owner_email: string | null; owner_phone: string | null; contact_phone: string | null };
  const subscription = detail.subscription as { package_id: string; custom_monthly_price: number | null; grace_days: number; status: string; current_period_start: string | null; current_period_end: string | null; trial_ends_at: string | null; package: { name: string; branch_limit: number; monthly_price: number } } | null;
  const branches = detail.branches as { id: string; name: string; city: string | null; phone: string | null; is_active: boolean }[];
  const employees = detail.employees as { id: string; profile_id: string; role: string; is_active: boolean; branch_id: string }[];
  const invoices = detail.invoices as { id: string; invoice_number: string; invoice_type: string; status: string; amount: number; period_start: string; period_end: string; due_date: string; whatsapp_sent_at: string | null; decision_note: string | null; organization: { id: string; name: string } | null; package: { name: string } | null }[];

  return <div className="mx-auto max-w-7xl space-y-6"><Button variant="ghost" size="sm" asChild><Link href="/owner/tenants"><ArrowLeftIcon className="size-4" /> Kembali ke tenants</Link></Button><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"><Building2Icon className="size-3.5" /> Tenant detail</div><h1 className="mt-1 font-heading text-3xl">{organization.name}</h1><p className="mt-1 font-mono text-xs text-muted-foreground">{organization.slug} · {organization.owner_email ?? "tanpa email"}</p></div><Badge variant={statusVariant(organization.status)} className="w-fit">{organization.status}</Badge></div><div className="grid gap-4 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle className="text-base">Subscription</CardTitle><CardDescription>Harga effective dan lifecycle renewal tenant.</CardDescription></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-3"><div><div className="text-xs text-muted-foreground">Paket</div><div className="mt-1 font-medium">{subscription?.package.name ?? "—"}</div></div><div><div className="text-xs text-muted-foreground">Harga / bulan</div><div className="mt-1 font-medium">{formatRupiah(subscription?.custom_monthly_price ?? subscription?.package.monthly_price ?? 0)}</div></div><div><div className="text-xs text-muted-foreground">Renewal / trial</div><div className="mt-1 font-medium">{formatDate(subscription?.status === "trial" ? subscription.trial_ends_at : subscription?.current_period_end ?? null)}</div></div></div><div className="mt-5 border-t pt-5"><SubscriptionForm organizationId={organization.id} subscription={subscription} packages={packages.map((item) => ({ id: item.id, name: item.name, monthly_price: item.monthly_price, branch_limit: item.branch_limit }))} /></div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Kontak & branch</CardTitle><CardDescription>Data和 akses tenant.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><div><div className="text-xs text-muted-foreground">WhatsApp</div><div className="mt-1 font-mono">{organization.contact_phone ?? organization.owner_phone ?? "—"}</div></div><div><div className="text-xs text-muted-foreground">Branch aktif</div><div className="mt-1">{branches.filter((branch) => branch.is_active).length} / {subscription?.package.branch_limit ?? "—"}</div></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPinIcon className="size-3.5" /> {branches.filter((branch) => branch.is_active).map((branch) => branch.name).join(", ") || "Belum ada branch"}</div></CardContent></Card></div><div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCardIcon className="size-4" /> Invoice history</CardTitle><CardDescription>Approval admin mengaktifkan atau memperpanjang paket.</CardDescription></CardHeader><CardContent><InvoiceReviewTable invoices={invoices} /></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UsersIcon className="size-4" /> Staff account</CardTitle><CardDescription>Role tenant dan status akses.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Profile</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{employees.map((employee) => <TableRow key={employee.id}><TableCell className="font-mono text-xs">{employee.profile_id.slice(0, 8)}</TableCell><TableCell><Badge variant="outline">{employee.role}</Badge></TableCell><TableCell><Badge variant={employee.is_active ? "success" : "outline"}>{employee.is_active ? "active" : "inactive"}</Badge></TableCell><TableCell><EmployeeActiveToggle employeeId={employee.id} active={employee.is_active} /></TableCell></TableRow>)}{employees.length === 0 ? <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Belum ada staff.</TableCell></TableRow> : null}</TableBody></Table></CardContent></Card></div></div>;
}
