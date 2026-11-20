"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ArrowRightIcon, SearchIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { deleteTenantPermanently } from "@/app/owner/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { formatRupiah } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CardFrame,
  CardFrameAction,
  CardFrameDescription,
  CardFrameFooter,
  CardFrameHeader,
  CardFrameTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  owner_email: string | null;
  package: { name: string; branch_limit: number } | null;
  subscriptionStatus: string;
  accessState: string;
  effectivePrice: number;
  activeBranchCount: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

export const ACCESS_STATUSES = ["trial", "active", "grace", "blocked"] as const;

export function filterTenants(
  tenants: TenantRow[],
  options: { statuses: string[]; packageName: string; query: string },
): TenantRow[] {
  const q = options.query.trim().toLowerCase();
  return tenants.filter((tenant) => {
    if (!options.statuses.includes(tenant.accessState)) return false;
    if (options.packageName !== "all" && tenant.package?.name !== options.packageName) return false;
    if (!q) return true;
    return [tenant.name, tenant.slug, tenant.owner_email]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(q));
  });
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value))
    : "—";
}

function statusVariant(status: string) {
  if (status === "active") return "success" as const;
  if (status === "trial") return "info" as const;
  if (status === "grace") return "warning" as const;
  if (status === "blocked" || status === "cancelled") return "destructive" as const;
  return "outline" as const;
}

function renewalLabel(tenant: TenantRow) {
  if (tenant.accessState === "trial") return `Trial ends ${formatDate(tenant.trialEndsAt)}`;
  if (tenant.accessState === "grace") return `Grace until ${formatDate(tenant.currentPeriodEnd)}`;
  if (tenant.accessState === "blocked") return `Ended ${formatDate(tenant.currentPeriodEnd)}`;
  return `Renews ${formatDate(tenant.currentPeriodEnd)}`;
}

function TenantTable({
  tenants,
  emptyLabel,
  onDelete,
}: {
  tenants: TenantRow[];
  emptyLabel: string;
  onDelete?: (tenant: TenantRow) => void;
}) {
  return (
    <div data-slot="table-container" className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tenant</TableHead>
            <TableHead>Paket</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Harga efektif</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Renewal / trial</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.map((tenant) => (
            <TableRow key={tenant.id}>
              <TableCell>
                <div className="flex items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{tenant.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{tenant.slug}</div>
                  </div>
                  {onDelete ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Hapus permanen ${tenant.name}`}
                      onClick={() => onDelete(tenant)}
                    >
                      <Trash2Icon className="size-3.5 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{tenant.package?.name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(tenant.accessState)}>{tenant.accessState}</Badge>
                {tenant.subscriptionStatus !== tenant.accessState ? (
                  <span className="ml-1 text-[10px] text-muted-foreground">DB: {tenant.subscriptionStatus}</span>
                ) : null}
              </TableCell>
              <TableCell>{formatRupiah(tenant.effectivePrice)}</TableCell>
              <TableCell>{tenant.activeBranchCount} / {tenant.package?.branch_limit ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{renewalLabel(tenant)}</TableCell>
              <TableCell>
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/owner/tenants/${tenant.id}`} aria-label={`Buka ${tenant.name}`}>
                    <ArrowRightIcon className="size-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {tenants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

export function TenantDirectory({
  tenants,
  archivedTenants,
}: {
  tenants: TenantRow[];
  archivedTenants: TenantRow[];
}) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<string[]>([...ACCESS_STATUSES]);
  const [packageName, setPackageName] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deletingTenant, setDeletingTenant] = useState<TenantRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const packageNames = useMemo(
    () =>
      Array.from(
        new Set(tenants.map((tenant) => tenant.package?.name).filter((name): name is string => Boolean(name))),
      ).sort(),
    [tenants],
  );

  const filtered = useMemo(
    () => filterTenants(tenants, { statuses, packageName, query }),
    [tenants, statuses, packageName, query],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => { setPage(1); }, [statuses, packageName, query, pageSize]);

  const toggleStatus = (status: string, checked: boolean) => {
    setStatuses((current) =>
      checked ? [...current, status] : current.filter((item) => item !== status),
    );
  };

  const closeDeleteDialog = (open: boolean) => {
    if (!open) {
      setDeletingTenant(null);
      setDeleteConfirm("");
    }
  };

  const handlePermanentDelete = async () => {
    if (!deletingTenant || deleteConfirm.trim() !== deletingTenant.name.trim()) return;
    setDeleting(true);
    try {
      await deleteTenantPermanently({
        organizationId: deletingTenant.id,
        confirmName: deleteConfirm,
      });
      playPageTransition();
      toast.success(`Tenant "${deletingTenant.name}" dihapus permanen`);
      closeDeleteDialog(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus tenant");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <CardFrame>
        <CardFrameHeader>
          <CardFrameTitle>Tenant aktif</CardFrameTitle>
          <CardFrameDescription>
            Menampilkan {filtered.length} dari {tenants.length} tenant aktif.
          </CardFrameDescription>
          <CardFrameAction>
            <Badge variant="secondary" size="sm" className="font-mono tabular-nums">{tenants.length}</Badge>
          </CardFrameAction>
        </CardFrameHeader>

        <div className="space-y-3 px-6 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama, slug, email owner..."
                className="pl-9"
                aria-label="Cari tenant"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <fieldset className="flex flex-wrap items-center gap-3">
                <legend className="mr-1 text-xs text-muted-foreground">Status</legend>
                {ACCESS_STATUSES.map((status) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`tenant-status-${status}`}
                      checked={statuses.includes(status)}
                      onCheckedChange={(checked) => toggleStatus(status, checked === true)}
                    />
                    <Label htmlFor={`tenant-status-${status}`} className="text-xs capitalize">{status}</Label>
                  </div>
                ))}
              </fieldset>
              <div className="flex items-center gap-2">
                <Label htmlFor="tenant-package" className="text-xs text-muted-foreground">Paket</Label>
                <Select value={packageName} onValueChange={(value) => setPackageName(value ?? "all")}>
                  <SelectTrigger id="tenant-package" size="sm" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="all">Semua paket</SelectItem>
                    {packageNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectPopup>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <TenantTable tenants={pageItems} emptyLabel="Tidak ada tenant yang cocok." />

        {filtered.length > 0 ? (
          <CardFrameFooter>
            <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Per halaman</span>
                <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                  <SelectTrigger size="sm" className="w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectPopup>
                </Select>
                <span>
                  · Menampilkan {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} dari {filtered.length}
                </span>
              </div>
              <Pagination page={safePage} pageCount={totalPages} onPageChange={setPage} />
            </div>
          </CardFrameFooter>
        ) : null}
      </CardFrame>

      <CardFrame>
        <CardFrameHeader>
          <CardFrameTitle>Tenant diarsipkan</CardFrameTitle>
          <CardFrameDescription>
            {archivedTenants.length} tenant tidak aktif. Bisa dihapus permanen lewat tombol di kolom tenant.
          </CardFrameDescription>
        </CardFrameHeader>
        <TenantTable
          tenants={archivedTenants}
          emptyLabel="Belum ada tenant yang diarsipkan."
          onDelete={setDeletingTenant}
        />
      </CardFrame>

      <DialogPrimitive.Root open={deletingTenant !== null} onOpenChange={closeDeleteDialog}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-0 shadow-2xl">
            <div className="flex items-center gap-3 border-b px-6 py-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/10">
                <TriangleAlertIcon className="size-4 text-destructive" />
              </div>
              <div>
                <DialogPrimitive.Title className="font-heading text-base font-semibold">
                  Hapus tenant permanen
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-muted-foreground">
                  {deletingTenant?.name}
                </DialogPrimitive.Description>
              </div>
            </div>
            <div className="space-y-3 px-6 py-4">
              <p className="rounded-lg bg-destructive/5 p-3 text-xs text-muted-foreground">
                Tindakan ini menghapus tenant beserta seluruh data terkait (transaksi, invoice, staf,
                branch). Tidak bisa dibatalkan.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-delete-tenant">
                  Ketik <span className="font-mono text-foreground">{deletingTenant?.name}</span> untuk konfirmasi
                </Label>
                <Input
                  id="confirm-delete-tenant"
                  value={deleteConfirm}
                  onChange={(event) => setDeleteConfirm(event.target.value)}
                  placeholder={deletingTenant?.name}
                  autoComplete="off"
                  disabled={deleting}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t bg-muted/20 px-6 py-3">
              <Button variant="outline" onClick={() => closeDeleteDialog(false)} disabled={deleting}>
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handlePermanentDelete()}
                disabled={!deletingTenant || deleteConfirm.trim() !== deletingTenant.name.trim() || deleting}
                loading={deleting}
              >
                <Trash2Icon className="size-4" /> Hapus permanen
              </Button>
            </div>
            <DialogPrimitive.Close
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Tutup"
            >
              ×
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
