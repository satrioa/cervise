import { PhoneIcon } from "lucide-react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerSearch, CustomerFilters, CustomerExportButton, CUSTOMER_DEFAULTS } from "@/components/customer/customer-toolbar";
import { CustomerCreateButton } from "@/components/customer/customer-create-button";
import { CustomerRowActions } from "@/components/customer/customer-row-actions";
import { PageHeader } from "@/components/layout/page-header";
import { getCustomers, type CustomerListRow } from "./actions";

type FallbackRow = CustomerListRow & { phoneDisplay: string; createdAt: string };

const FALLBACK: FallbackRow[] = [
  { id: "fb-1", name: "Rina Hartati", phone: "6281212345601", phoneDisplay: "0812 1234 5601", totalServis: 3, totalSpent: 1250000, lastServis: "SV-001", lastStatus: "Dikerjakan", lastDate: "21 Sep 2026", lastDateRaw: null, createdAt: "10 Jan 2025", createdAtRaw: "2025-01-10T00:00:00.000Z" },
  { id: "fb-2", name: "Agus Pratama", phone: "6281313445602", phoneDisplay: "0813 1344 5602", totalServis: 1, totalSpent: 350000, lastServis: "SV-002", lastStatus: "Menunggu Sparepart", lastDate: "20 Sep 2026", lastDateRaw: null, createdAt: "05 Mar 2025", createdAtRaw: "2025-03-05T00:00:00.000Z" },
  { id: "fb-3", name: "Dewi Lestari", phone: "6281212880103", phoneDisplay: "0812 1288 0103", totalServis: 2, totalSpent: 780000, lastServis: "SV-003", lastStatus: "Selesai", lastDate: "19 Sep 2026", lastDateRaw: null, createdAt: "12 Feb 2025", createdAtRaw: "2025-02-12T00:00:00.000Z" },
  { id: "fb-4", name: "Bambang Wijaya", phone: "6281299001122", phoneDisplay: "0812 9900 1122", totalServis: 5, totalSpent: 2150000, lastServis: "SV-006", lastStatus: "Sudah Diambil", lastDate: "17 Sep 2026", lastDateRaw: null, createdAt: "22 Nov 2024", createdAtRaw: "2024-11-22T00:00:00.000Z" },
  { id: "fb-5", name: "Citra Amelia", phone: "6281245667788", phoneDisplay: "0812 4566 7788", totalServis: 4, totalSpent: 1680000, lastServis: "SV-007", lastStatus: "Selesai", lastDate: "12 Sep 2026", lastDateRaw: null, createdAt: "18 Jan 2025", createdAtRaw: "2025-01-18T00:00:00.000Z" },
  { id: "fb-6", name: "Eko Saputra", phone: "6281212009900", phoneDisplay: "0812 1200 9900", totalServis: 1, totalSpent: 0, lastServis: "SV-010", lastStatus: "Masuk", lastDate: "21 Sep 2026", lastDateRaw: null, createdAt: "03 Sep 2026", createdAtRaw: "2026-09-03T00:00:00.000Z" },
];

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

  let live: CustomerListRow[] = [];
  try {
    live = await getCustomers();
  } catch {
    live = [];
  }
  const base: CustomerListRow[] = live.length ? live : FALLBACK;

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
                    Tidak ada customer yang cocok
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