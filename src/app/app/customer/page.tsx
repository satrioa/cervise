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

export default async function CustomerPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; sort?: string }> }) {
  const { q, status, sort } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const statusFilter = (status ?? "").trim() || CUSTOMER_DEFAULTS.status;
  const sortKey = (sort ?? "").trim() || CUSTOMER_DEFAULTS.sort;

  const { data: live, error } = await getCustomersSafe();
  if (error) {
    return (
      <div className="bg-background text-foreground">
        <PageHeader title="Customer" titleClassName="font-heading text-2xl" />
        <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-8">
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

  const totalCount = base.length;

  return (
    <div className="min-h-svh bg-background">
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
        actions={
          <>
            <CustomerCreateButton />
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
                sorted.map((c) => (
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
        </div>
      </div>
    </div>
  );
}