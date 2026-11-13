"use client";

import { useMemo, useState, useEffect } from "react";
import { MailIcon, SearchIcon, UserRoundIcon } from "lucide-react";
import type { OwnerAccountRow } from "@/lib/platform/owner-accounts";
import { EmployeeActiveToggle } from "@/components/owner/employee-active-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
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

export function OwnerAccountsTable({ accounts }: { accounts: OwnerAccountRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
  useEffect(() => { setPage(1); }, [query, filter]);

  const counts = useMemo(() => ({
    all: accounts.length,
    tenant: accounts.filter((account) => account.isAssigned).length,
    unassigned: accounts.filter((account) => account.isUnassigned).length,
    platform: accounts.filter((account) => account.isPlatformAdmin).length,
    inactive: accounts.filter((account) => !account.isActive).length,
  }), [accounts]);

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, email, tenant..." className="pl-9" aria-label="Cari akun" />
      </div>
      <FilterGroup
        breakpoint="lg"
        count={filter === "all" ? 0 : 1}
        summary={filter === "all" ? undefined : `Filter: ${filters.find((item) => item.key === filter)?.label ?? filter}`}
        onClear={() => setFilter("all")}
      >
        {filters.map((item) => <Button key={item.key} type="button" size="sm" variant={filter === item.key ? "secondary" : "ghost"} onClick={() => setFilter(item.key)} className="shrink-0">
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
          {pageItems.map((account) => <TableRow key={account.id}>
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
            <TableCell>
              {account.employeeId ? <EmployeeActiveToggle employeeId={account.employeeId} active={account.isActive} /> : <span className="text-xs text-muted-foreground">—</span>}
            </TableCell>
          </TableRow>)}
          {filteredAccounts.length === 0 ? <TableRow><TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">Tidak ada akun yang cocok.</TableCell></TableRow> : null}
        </TableBody>
      </Table>
    </div>
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
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (safePage > 1) setPage(safePage - 1); }} aria-disabled={safePage === 1} className={safePage === 1 ? "pointer-events-none opacity-50" : ""} />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, safePage - 3), Math.max(0, safePage - 3) + 5).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink href="#" isActive={p === safePage} onClick={(e) => { e.preventDefault(); setPage(p); }}>{p}</PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (safePage < totalPages) setPage(safePage + 1); }} aria-disabled={safePage === totalPages} className={safePage === totalPages ? "pointer-events-none opacity-50" : ""} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    ) : null}
    <div className="text-xs text-muted-foreground">Menampilkan {filteredAccounts.length} dari {accounts.length} akun terdaftar Cervise.</div>
  </div>;
}
