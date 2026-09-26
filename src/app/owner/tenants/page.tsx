import Link from "next/link";
import { ArrowRightIcon, Building2Icon } from "lucide-react";
import { getOwnerDashboard } from "../actions";
import { CreateTenantDialog } from "@/components/owner/create-tenant-dialog";
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

export default async function OwnerTenantsPage() {
  const { tenants } = await getOwnerDashboard();
  return <div className="mx-auto max-w-7xl space-y-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"><Building2Icon className="size-3.5" /> Tenant management</div><h1 className="mt-1 font-heading text-3xl">Tenants</h1><p className="mt-1 text-sm text-muted-foreground">Semua tenant Cervise yang berada di bawah platform Anda.</p></div><CreateTenantDialog /></div><Card><CardHeader><CardTitle className="text-base">Tenant directory</CardTitle><CardDescription>{tenants.length} tenant terdaftar.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Tenant</TableHead><TableHead>Paket</TableHead><TableHead>Status</TableHead><TableHead>Harga efektif</TableHead><TableHead>Branch</TableHead><TableHead>Renewal / trial</TableHead><TableHead /></TableRow></TableHeader><TableBody>{tenants.map((tenant) => <TableRow key={tenant.id}><TableCell><div className="font-medium">{tenant.name}</div><div className="font-mono text-xs text-muted-foreground">{tenant.slug}</div></TableCell><TableCell>{tenant.package?.name ?? "—"}</TableCell><TableCell><Badge variant={statusVariant(tenant.subscriptionStatus)}>{tenant.subscriptionStatus}</Badge></TableCell><TableCell>{formatRupiah(tenant.effectivePrice)}</TableCell><TableCell>{tenant.activeBranchCount} / {tenant.package?.branch_limit ?? "—"}</TableCell><TableCell className="text-xs text-muted-foreground">{tenant.subscriptionStatus === "trial" ? `Trial ends ${formatDate(tenant.trialEndsAt)}` : `Renews ${formatDate(tenant.currentPeriodEnd)}`}</TableCell><TableCell><Button size="sm" variant="ghost" asChild><Link href={`/owner/tenants/${tenant.id}`}><ArrowRightIcon className="size-4" /></Link></Button></TableCell></TableRow>)}{tenants.length === 0 ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Belum ada tenant.</TableCell></TableRow> : null}</TableBody></Table></CardContent></Card></div>;
}
