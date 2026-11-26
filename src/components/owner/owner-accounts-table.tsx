"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EllipsisIcon, EyeIcon, MailIcon, SearchIcon, TrashIcon, UserCheckIcon, UserRoundIcon, UserXIcon } from "lucide-react";
import type { OwnerAccountRow } from "@/lib/platform/owner-accounts";
import { deleteOwnerAccount, setAccountActive } from "@/app/owner/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Menu, MenuItem, MenuPopup, MenuSeparator } from "@/components/ui/menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterGroup } from "@/components/layout/filter-group";

type Filter = "all" | "tenant" | "unassigned" | "platform" | "inactive";

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "tenant", label: "Tenant staff" },
  { key: "unassigned", label: "Belum ada tenant" },
  { key: "platform", label: "Platform admin" },
  { key: "inactive", label: "Nonaktif" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    PLATFORM_ADMIN: "Platform Admin",
    UNASSIGNED: "Belum terdaftar",
    MASTER_ADMIN: "Master Admin",
    ADMIN: "Admin",
    FRONTLINER: "Frontliner",
    TECHNICIAN: "Technician",
  };
  return labels[role] ?? role;
}

function stateVariant(state: OwnerAccountRow["state"]) {
  if (state === "active") return "success" as const;
  if (state === "unassigned") return "info" as const;
  return "outline" as const;
}

function stateLabel(state: OwnerAccountRow["state"]) {
  if (state === "active") return "Aktif";
  if (state === "unassigned") return "Belum ada tenant";
  return "Nonaktif";
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return <div className="flex justify-between gap-4 border-b py-1.5 last:border-0">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value || "—"}</span>
  </div>;
}

export function OwnerAccountsTable({ accounts }: { accounts: OwnerAccountRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [menu, setMenu] = useState<{ account: OwnerAccountRow; x: number; y: number } | null>(null);
  const [detailAccount, setDetailAccount] = useState<OwnerAccountRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OwnerAccountRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return accounts.filter((account) => {
      const searchableValues = [account.fullName, account.email, account.tenantName, account.role].filter(
        (value): value is string => Boolean(value),
      );
      const matchesQuery = !normalizedQuery || searchableValues.some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesFilter = filter === "all"
        || (filter === "tenant" && account.isAssigned)
        || (filter === "unassigned" && account.isUnassigned)
        || (filter === "platform" && account.isPlatformAdmin)
        || (filter === "inactive" && !account.isActive);
      return matchesQuery && matchesFilter;
    });
  }, [accounts, filter, query]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = filteredAccounts.slice((safePage - 1) * pageSize, safePage * pageSize);

  const counts = useMemo(() => ({
    all: accounts.length,
    tenant: accounts.filter((account) => account.isAssigned).length,
    unassigned: accounts.filter((account) => account.isUnassigned).length,
    platform: accounts.filter((account) => account.isPlatformAdmin).length,
    inactive: accounts.filter((account) => !account.isActive).length,
  }), [accounts]);

  const activeAccount = menu?.account;
  const menuAnchor = menu ? { getBoundingClientRect: () => new DOMRect(menu.x, menu.y, 0, 0) } : undefined;

  const openMenu = (account: OwnerAccountRow, x: number, y: number) => setMenu({ account, x, y });

  const handleToggle = async (account: OwnerAccountRow) => {
    setBusy(true);
    try {
      await setAccountActive({ userId: account.id, active: !account.isActive });
      router.refresh();
      playPageTransition();
      toast.success(account.isActive ? "Akun dinonaktifkan" : "Akun diaktifkan");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengubah status akun");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteOwnerAccount({ userId: deleteTarget.id });
      setDeleteTarget(null);
      router.refresh();
      playPageTransition();
      toast.success("Akun dihapus permanen");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menghapus akun";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Cari nama, email, tenant..." className="pl-9" aria-label="Cari akun" />
      </div>
      <FilterGroup
        breakpoint="lg"
        count={filter === "all" ? 0 : 1}
        summary={filter === "all" ? undefined : `Filter: ${filters.find((item) => item.key === filter)?.label ?? filter}`}
        onClear={() => setFilter("all")}
      >
        {filters.map((item) => <Button key={item.key} type="button" size="sm" variant={filter === item.key ? "secondary" : "ghost"} onClick={() => { setFilter(item.key); setPage(1); }} className="shrink-0">
          {item.label}<span className="ml-1 text-[10px] text-muted-foreground">{counts[item.key]}</span>
        </Button>)}
      </FilterGroup>
    </div>
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Akun</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Package</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Terdaftar</TableHead>
            <TableHead>Terakhir masuk</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((account) => <TableRow
            key={account.id}
            className="cursor-context-menu hover:bg-muted/40"
            onContextMenu={(event) => {
              event.preventDefault();
              openMenu(account, event.clientX, event.clientY);
            }}
          >
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06]"><UserRoundIcon className="size-4 text-muted-foreground" /></div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{account.fullName}</div>
                  <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><MailIcon className="size-3" />{account.email ?? "Tanpa email"}</div>
                    {account.phone ? <div>{account.phone}</div> : null}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="font-medium">{account.tenantName ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{account.branchName ?? "Belum terhubung"}</div>
            </TableCell>
            <TableCell><Badge variant={account.isPlatformAdmin ? "info" : "outline"}>{roleLabel(account.role)}</Badge></TableCell>
            <TableCell>
              <div className="text-sm">{account.packageName ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{account.subscriptionStatus ?? "Belum ada subscription"}</div>
            </TableCell>
            <TableCell><Badge variant={stateVariant(account.state)}>{stateLabel(account.state)}</Badge></TableCell>
            <TableCell className="text-xs text-muted-foreground">{formatDate(account.createdAt)}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{formatDate(account.lastSignInAt)}</TableCell>
            <TableCell className="text-right">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Menu akun ${account.fullName}`}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  openMenu(account, rect.left, rect.bottom + 4);
                }}
              >
                <EllipsisIcon />
              </Button>
            </TableCell>
          </TableRow>)}
          {filteredAccounts.length === 0 ? <TableRow><TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">Tidak ada akun yang cocok.</TableCell></TableRow> : null}
        </TableBody>
      </Table>
    </div>

    <Menu open={Boolean(menu)} onOpenChange={(open) => { if (!open) setMenu(null); }}>
      <MenuPopup anchor={menuAnchor} side="bottom" align="start" sideOffset={4}>
        <MenuItem onClick={() => { if (activeAccount) setDetailAccount(activeAccount); }}>
          <EyeIcon />Lihat detail
        </MenuItem>
        <MenuItem disabled={busy} onClick={() => { if (activeAccount) void handleToggle(activeAccount); }}>
          {activeAccount?.isActive ? <UserXIcon /> : <UserCheckIcon />}
          {activeAccount?.isActive ? "Nonaktifkan" : "Aktifkan"}
        </MenuItem>
        <MenuSeparator />
        <MenuItem variant="destructive" onClick={() => { if (activeAccount) setDeleteTarget(activeAccount); }}>
          <TrashIcon />Hapus akun
        </MenuItem>
      </MenuPopup>
    </Menu>

    <Dialog open={Boolean(detailAccount)} onOpenChange={(open) => { if (!open) setDetailAccount(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detail akun</DialogTitle>
          <DialogDescription>Data akun yang terdaftar di Kaggo.</DialogDescription>
        </DialogHeader>
        <div className="text-sm">
          <DetailRow label="Nama" value={detailAccount?.fullName ?? null} />
          <DetailRow label="Email" value={detailAccount?.email ?? null} />
          <DetailRow label="Telepon" value={detailAccount?.phone ?? null} />
          <DetailRow label="Tenant" value={detailAccount?.tenantName ?? null} />
          <DetailRow label="Cabang" value={detailAccount?.branchName ?? null} />
          <DetailRow label="Role" value={detailAccount ? roleLabel(detailAccount.role) : null} />
          <DetailRow label="Package" value={detailAccount?.packageName ?? null} />
          <DetailRow label="Status subscription" value={detailAccount?.subscriptionStatus ?? null} />
          <DetailRow label="Status akun" value={detailAccount ? stateLabel(detailAccount.state) : null} />
          <DetailRow label="Terdaftar" value={detailAccount ? formatDate(detailAccount.createdAt) : null} />
          <DetailRow label="Terakhir masuk" value={detailAccount ? formatDate(detailAccount.lastSignInAt) : null} />
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
      if (!open) { setDeleteTarget(null); setDeleteError(null); }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus akun secara permanen?</DialogTitle>
          <DialogDescription>
            {deleteTarget
              ? `${deleteTarget.fullName} · ${deleteTarget.email ?? "Tanpa email"} akan dihapus dari database beserta data terkait. Tindakan ini tidak bisa dibatalkan.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {deleteError ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{deleteError}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={busy}>Batal</Button>
          <Button variant="destructive" onClick={() => void handleDelete()} disabled={busy}>{busy ? "Menghapus..." : "Hapus akun"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {filteredAccounts.length > 0 ? (
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Per halaman</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
            <SelectTrigger size="sm" className="w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectPopup>
          </Select>
          <span>· Menampilkan {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredAccounts.length)} dari {filteredAccounts.length}</span>
        </div>
        <Pagination page={safePage} pageCount={totalPages} onPageChange={setPage} />
      </div>
    ) : null}
    <div className="text-xs text-muted-foreground">Menampilkan {filteredAccounts.length} dari {accounts.length} akun terdaftar Kaggo.</div>
  </div>;
}
