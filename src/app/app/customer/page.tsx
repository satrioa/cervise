import { PhoneIcon } from "lucide-react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerSearch, CustomerFilters, CustomerExportButton, CUSTOMER_DEFAULTS } from "@/components/customer/customer-toolbar";
import { CustomerCreateButton } from "@/components/customer/customer-create-button";
import { CustomerRowActions } from "@/components/customer/customer-row-actions";
import { PageHeader } from "@/components/layout/page-header";
import { getCustomersSafe, type CustomerListRow } from "./actions";

function statusTone(s: string) {
  if (s === "Selesai" || s === "Sudah Diambil") return "bg-emerald-500";
  if (s === "Dikerjakan") return "bg-blue-500";
  if (s === "Menunggu Sparepart") return "bg-amber-500";
  if (s === "Masuk") return "bg-zinc-400";
  return "bg-muted-foreground/40";
}

export default async function CustomerPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; sort?: string; new?: string; page?: string; pageSize?: string }> }) {
  const { q, status, sort, new: newParam, page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const statusFilter = (status ?? "").trim() || CUSTOMER_DEFAULTS.status;
  const sortKey = (sort ?? "").trim() || CUSTOMER_DEFAULTS.sort;

  const { data: live, error } = await getCustomersSafe();
  if (error) {
    return (
      <div className="bg-transparent text-foreground">
        <PageHeader title="Customer" titleClassName="font-heading text-2xl" />
        <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Gagal memuat data customer: {error.message}
          </div>
        </main>
      </div>
    );
  }
  const base: CustomerListRow[] = live;

  const filtered = base.filter((c) => {
    if (query && !`${c.name} ${c.phoneDisplay} ${c.phone} ${c.lastServis} ${c.lastStatus}`.toLowerCase().includes(query)) return false;
    if (statusFilter !== CUSTOMER_DEFAULTS.status && c.lastStatus !== statusFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case "nama":
        return a.name.localeCompare(b.name, "id");
      case "spent-desc":
        return b.totalSpent - a.totalSpent;
      case "spent-asc":
        return a.totalSpent - b.totalSpent;
      case "servis-desc":
        return b.totalServis - a.totalServis;
      case "terbaru":
      default:
        return new Date(b.lastDateRaw ?? b.createdAtRaw).getTime() - new Date(a.lastDateRaw ?? a.createdAtRaw).getTime();
    }
  });

  const pageSize = [10, 20, 50].includes(Number(pageSizeParam)) ? Number(pageSizeParam) : 25;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const requestedPage = Math.max(1, Number(pageParam) || 1);
  const safePage = Math.min(requestedPage, totalPages);
  const pageItems = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const totalCount = base.length;
  const statusActive = statusFilter !== CUSTOMER_DEFAULTS.status;
  const customerClearHref = q ? `/app/customer?q=${encodeURIComponent(q)}` : "/app/customer";

  return (
    <div className="min-h-svh bg-transparent">
      <PageHeader
        title="Customer"
        description={`Menampilkan ${sorted.length} dari ${totalCount} customer · isolasi per cabang`}
        containerClassName="max-w-5xl"
        search={<CustomerSearch query={q?.trim() ?? ""} />}
        filters={
          <CustomerFilters
            query={q?.trim() ?? ""}
            status={statusFilter}
            sort={sortKey}
          />
        }
        filterCount={statusActive ? 1 : 0}
        filterSummary={statusActive ? `Status: ${statusFilter}` : undefined}
        filterClearHref={customerClearHref}
        actions={
          <>
            <CustomerCreateButton initialOpen={newParam === "1"} />
            <CustomerExportButton
              exportRows={sorted.map((c) => ({
                name: c.name,
                phone: c.phoneDisplay,
                totalServis: c.totalServis,
                totalSpent: c.totalSpent,
                lastServis: c.lastServis,
                lastStatus: c.lastStatus,
                lastDate: c.lastDate,
                createdAt: c.createdAt,
              }))}
            />
          </>
        }
      />

      <div className="px-6 py-8">
        <div className="mx-auto max-w-5xl">
        <div className="rounded-xl border bg-card shadow-xs/5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">Customer</TableHead>
                <TableHead>HP (WA)</TableHead>
                <TableHead>Total Servis</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Terakhir</TableHead>
                <TableHead className="pe-4 w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    {base.length === 0
                      ? "Belum ada customer di cabang ini"
                      : "Tidak ada customer yang cocok dengan filter"}
                  </TableCell>
                </TableRow>
              ) : (
                pageItems.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="ps-4">
                      <div className="min-w-0">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-muted-foreground text-xs">Pelanggan tetap · Bergabung {c.createdAt}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center gap-1.5">
                        <PhoneIcon className="size-3 text-muted-foreground" />
                        <span className="font-mono text-xs tabular-nums">{c.phoneDisplay}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" size="sm" className="font-mono tabular-nums">
                        {c.totalServis} servis
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{formatCurrencyPlain(c.totalSpent)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 font-mono text-xs">
                          <span className={"size-1.5 rounded-full " + statusTone(c.lastStatus)} />
                          {c.lastServis !== "—" ? `${c.lastServis} · ${c.lastStatus}` : c.lastStatus}
                        </span>
                        <span className="text-muted-foreground text-xs tabular-nums">{c.lastDate}</span>
                      </div>
                    </TableCell>
                    <TableCell className="pe-4">
                      <CustomerRowActions customer={{ id: c.id, name: c.name, phone: c.phone, phoneDisplay: c.phoneDisplay, totalServis: c.totalServis, totalSpent: c.totalSpent }} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {sorted.length > 0 ? (
          <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Per halaman</span>
              {[10, 20, 50].map((n) => {
                const params = new URLSearchParams();
                if (q) params.set("q", q);
                if (status && status !== CUSTOMER_DEFAULTS.status) params.set("status", status);
                if (sort && sort !== CUSTOMER_DEFAULTS.sort) params.set("sort", sort);
                params.set("pageSize", String(n));
                params.set("page", "1");
                return (
                  <a key={n} href={`/app/customer?${params.toString()}`} className={"rounded px-2 py-0.5 " + (pageSize === n ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{n}</a>
                );
              })}
              <span>· Menampilkan {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} dari {sorted.length}</span>
            </div>
            <nav className="flex items-center gap-1 text-sm">
              {safePage > 1 ? (
                <a className="rounded px-2 py-1 hover:bg-muted" href={(() => { const p = new URLSearchParams(); if (q) p.set("q", q); if (status && status !== CUSTOMER_DEFAULTS.status) p.set("status", status); if (sort && sort !== CUSTOMER_DEFAULTS.sort) p.set("sort", sort); p.set("pageSize", String(pageSize)); p.set("page", String(safePage - 1)); return `/app/customer?${p.toString()}`; })()}>Sebelumnya</a>
              ) : (
                <span className="rounded px-2 py-1 text-muted-foreground/50">Sebelumnya</span>
              )}
              <span className="px-2 text-muted-foreground">Hal. {safePage} / {totalPages}</span>
              {safePage < totalPages ? (
                <a className="rounded px-2 py-1 hover:bg-muted" href={(() => { const p = new URLSearchParams(); if (q) p.set("q", q); if (status && status !== CUSTOMER_DEFAULTS.status) p.set("status", status); if (sort && sort !== CUSTOMER_DEFAULTS.sort) p.set("sort", sort); p.set("pageSize", String(pageSize)); p.set("page", String(safePage + 1)); return `/app/customer?${p.toString()}`; })()}>Berikutnya</a>
              ) : (
                <span className="rounded px-2 py-1 text-muted-foreground/50">Berikutnya</span>
              )}
            </nav>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}