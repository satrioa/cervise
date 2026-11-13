import Link from "next/link";
import { ArrowRightIcon, Building2Icon, CircleDollarSignIcon, Clock3Icon, PackageIcon, PlusIcon } from "lucide-react";
import { getOwnerDashboard } from "./actions";
import { formatRupiah } from "@/lib/format";
import { CreateTenantDialog } from "@/components/owner/create-tenant-dialog";
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

export default async function OwnerDashboard({ searchParams }: { searchParams?: Promise<{ page?: string; pageSize?: string }> }) {
  const sp = (await searchParams) ?? {};
  const { tenants: allTenants, stats } = await getOwnerDashboard();
  const pageSize = [10, 20, 50].includes(Number(sp.pageSize)) ? Number(sp.pageSize) : 10;
  const totalPages = Math.max(1, Math.ceil(allTenants.length / pageSize));
  const safePage = Math.min(Math.max(1, Number(sp.page) || 1), totalPages);
  const tenants = allTenants.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Platform control center</div>
          <h1 className="mt-1 font-heading text-3xl">Owner overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kelola tenant Cervise, paket, renewal, dan akses staff dari satu tempat.</p>
        </div>
        <CreateTenantDialog />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Building2Icon className="size-4" /> Total tenant</CardTitle></CardHeader>
          <CardContent><div className="font-heading text-3xl tabular-nums">{stats.total}</div><div className="text-xs text-muted-foreground">{stats.active} active · {stats.trial} trial</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Clock3Icon className="size-4" /> Perlu perhatian</CardTitle></CardHeader>
          <CardContent><div className="font-heading text-3xl tabular-nums">{stats.grace + stats.blocked}</div><div className="text-xs text-muted-foreground">{stats.grace} grace · {stats.blocked} blocked</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><CircleDollarSignIcon className="size-4" /> Pending invoice</CardTitle></CardHeader>
          <CardContent><div className="font-heading text-3xl tabular-nums">{stats.pendingInvoices}</div><div className="text-xs text-muted-foreground">Menunggu verifikasi pembayaran</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue terkonfirmasi</CardTitle></CardHeader>
          <CardContent><div className="font-heading text-2xl tabular-nums">{formatRupiah(stats.collected)}</div><div className="text-xs text-muted-foreground">Invoice approved</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div><CardTitle className="text-base">Tenant terbaru</CardTitle><CardDescription>Status subscription, harga efektif, dan branch usage.</CardDescription></div>
          <Button variant="outline" size="sm" asChild><Link href="/owner/tenants">Lihat semua <ArrowRightIcon className="size-3.5" /></Link></Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Tenant</TableHead><TableHead>Paket</TableHead><TableHead>Status</TableHead><TableHead>Harga / bulan</TableHead><TableHead>Cabang</TableHead><TableHead>Periode / trial</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {tenants.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Belum ada tenant. Buat tenant pertama untuk memulai trial 14 hari.</TableCell></TableRow>
              ) : tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell><div className="font-medium">{tenant.name}</div><div className="font-mono text-xs text-muted-foreground">{tenant.owner_email ?? tenant.slug}</div></TableCell>
                  <TableCell>{tenant.package?.name ?? "—"}</TableCell>
                  <TableCell><Badge variant={statusVariant(tenant.accessState)}>{tenant.accessState}</Badge>{tenant.subscriptionStatus !== tenant.accessState ? <span className="ml-1 text-[10px] text-muted-foreground">DB: {tenant.subscriptionStatus}</span> : null}</TableCell>
                  <TableCell className="tabular-nums">{formatRupiah(tenant.effectivePrice)}</TableCell>
                  <TableCell>{tenant.activeBranchCount} / {tenant.package?.branch_limit ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{tenant.accessState === "trial" ? `Trial ends ${formatDate(tenant.trialEndsAt)}` : tenant.accessState === "grace" ? `Grace until ${formatDate(tenant.graceEndsAt)}` : tenant.accessState === "blocked" ? `Ended ${formatDate(tenant.currentPeriodEnd)}` : `Renews ${formatDate(tenant.currentPeriodEnd)}`}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" asChild><Link href={`/owner/tenants/${tenant.id}`}><ArrowRightIcon className="size-4" /></Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
            {allTenants.length > 0 ? (
              <div className="mt-4 flex flex-col items-center gap-3 border-t pt-4 sm:flex-row sm:justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Per halaman</span>
                  {[10, 20, 50].map((n) => {
                    const p = new URLSearchParams();
                    p.set("pageSize", String(n));
                    p.set("page", "1");
                    return <a key={n} href={`/owner?${p.toString()}`} className={"rounded px-2 py-0.5 " + (pageSize === n ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{n}</a>;
                  })}
                  <span>· Menampilkan {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, allTenants.length)} dari {allTenants.length}</span>
                </div>
                <nav className="flex items-center gap-1 text-sm">
                  {safePage > 1 ? <a className="rounded px-2 py-1 hover:bg-muted" href={`/owner?pageSize=${pageSize}&page=${safePage - 1}`}>Sebelumnya</a> : <span className="rounded px-2 py-1 text-muted-foreground/50">Sebelumnya</span>}
                  <span className="px-2 text-muted-foreground">Hal. {safePage} / {totalPages}</span>
                  {safePage < totalPages ? <a className="rounded px-2 py-1 hover:bg-muted" href={`/owner?pageSize=${pageSize}&page=${safePage + 1}`}>Berikutnya</a> : <span className="rounded px-2 py-1 text-muted-foreground/50">Berikutnya</span>}
                </nav>
              </div>
            ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Button variant="outline" className="h-auto justify-start p-4 text-left" asChild><Link href="/owner/packages"><PackageIcon className="size-4" /><span><span className="block font-medium">Kelola paket</span><span className="text-xs text-muted-foreground">Harga dan branch limit</span></span></Link></Button>
        <Button variant="outline" className="h-auto justify-start p-4 text-left" asChild><Link href="/owner/billing"><CircleDollarSignIcon className="size-4" /><span><span className="block font-medium">Review billing</span><span className="text-xs text-muted-foreground">Approve renewal invoice</span></span></Link></Button>
        <Button variant="outline" className="h-auto justify-start p-4 text-left" asChild><Link href="/owner/accounts"><PlusIcon className="size-4" /><span><span className="block font-medium">Kelola akun</span><span className="text-xs text-muted-foreground">Staff dan role tenant</span></span></Link></Button>
      </div>
    </div>
  );
}
