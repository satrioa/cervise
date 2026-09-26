"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDownIcon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GenericExportDialog, type ExportField } from "@/components/generic-export-dialog";

export const CUSTOMER_DEFAULTS = {
  query: "",
  status: "semua",
  sort: "terbaru",
};

const STATUS_OPTIONS = [
  { label: "Semua status", value: "semua" },
  { label: "Masuk", value: "Masuk" },
  { label: "Dikerjakan", value: "Dikerjakan" },
  { label: "Menunggu Sparepart", value: "Menunggu Sparepart" },
  { label: "Selesai", value: "Selesai" },
  { label: "Sudah Diambil", value: "Sudah Diambil" },
  { label: "Batal", value: "Batal" },
];

const SORT_OPTIONS = [
  { label: "Terakhir terbaru", value: "terbaru" },
  { label: "Nama A–Z", value: "nama" },
  { label: "Total Spent tertinggi", value: "spent-desc" },
  { label: "Total Spent terendah", value: "spent-asc" },
  { label: "Total Servis terbanyak", value: "servis-desc" },
];

const CUSTOMER_EXPORT_FIELDS: ExportField[] = [
  { id: "name", label: "Nama", default: true },
  { id: "phone", label: "HP", default: true },
  { id: "totalServis", label: "Total Servis", default: true },
  { id: "totalSpent", label: "Total Spent", default: true },
  { id: "lastServis", label: "Last Servis", default: true },
  { id: "lastStatus", label: "Last Status", default: false },
  { id: "lastDate", label: "Last Date", default: false },
  { id: "createdAt", label: "Created At", default: false },
];

function useCustomerCommit() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const commit = useCallback(
    (next: { q?: string; status?: string; sort?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = {
        q: searchParams.get("q") ?? "",
        status: searchParams.get("status") ?? CUSTOMER_DEFAULTS.status,
        sort: searchParams.get("sort") ?? CUSTOMER_DEFAULTS.sort,
      };
      const merged = { ...current, ...next };
      const setOrDelete = (key: string, value: string, def: string) => {
        if (value && value !== def) params.set(key, value);
        else params.delete(key);
      };
      setOrDelete("q", merged.q.trim(), "");
      setOrDelete("status", merged.status, CUSTOMER_DEFAULTS.status);
      setOrDelete("sort", merged.sort, CUSTOMER_DEFAULTS.sort);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return { commit };
}

export function CustomerSearch({ query: initialQuery }: { query: string }) {
  const { commit } = useCustomerCommit();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(initialQuery);
  const [prevQuery, setPrevQuery] = useState(initialQuery);
  if (initialQuery !== prevQuery) {
    setPrevQuery(initialQuery);
    setQuery(initialQuery);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      const paramQ = searchParams.get("q") ?? "";
      if (query.trim() !== paramQ) commit({ q: query });
    }, 300);
    return () => clearTimeout(t);
  }, [query, commit, searchParams]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <InputGroup className="h-8 w-full">
      <InputGroupAddon>
        <SearchIcon className="size-4 text-muted-foreground" />
      </InputGroupAddon>
      <InputGroupInput
        ref={searchRef}
        placeholder="Cari nama, HP, servis…"
        aria-label="Cari customer"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        nativeInput
      />
      <InputGroupAddon align="inline-end">
        <Kbd>/</Kbd>
      </InputGroupAddon>
    </InputGroup>
  );
}

export function CustomerFilters({
  query,
  status: initialStatus,
  sort: initialSort,
}: {
  query: string;
  status: string;
  sort: string;
}) {
  const { commit } = useCustomerCommit();

  const status = initialStatus || CUSTOMER_DEFAULTS.status;
  const sort = initialSort || CUSTOMER_DEFAULTS.sort;

  const activeCount =
    (query ? 1 : 0) + (status !== CUSTOMER_DEFAULTS.status ? 1 : 0) + (sort !== CUSTOMER_DEFAULTS.sort ? 1 : 0);

  const clear = () => {
    commit({ q: "", status: CUSTOMER_DEFAULTS.status, sort: CUSTOMER_DEFAULTS.sort });
  };

  return (
    <>
      <Select value={status} onValueChange={(v) => commit({ status: v ?? CUSTOMER_DEFAULTS.status })}>
        <SelectTrigger className="w-44 shrink-0" size="sm">
          <SelectValue>{STATUS_OPTIONS.find((s) => s.value === status)?.label ?? "Semua status"}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>

      <Select value={sort} onValueChange={(v) => commit({ sort: v ?? CUSTOMER_DEFAULTS.sort })}>
        <SelectTrigger className="w-48 shrink-0" size="sm">
          <ArrowUpDownIcon className="text-muted-foreground" />
          <SelectValue>{SORT_OPTIONS.find((s) => s.value === sort)?.label ?? "Terakhir terbaru"}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {SORT_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>

      {activeCount > 0 ? (
        <Button size="xs" variant="ghost" onClick={clear} className="h-8 shrink-0 px-1.5 text-muted-foreground">
          <XIcon /> Clear ({activeCount})
        </Button>
      ) : null}
    </>
  );
}

export function CustomerExportButton({ exportRows }: { exportRows: Record<string, any>[] }) {
  const [exportOpen, setExportOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => setExportOpen(true)}>
        Export
      </Button>
      <GenericExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Export Customer"
        description="Unduh data customer terfilter."
        fields={CUSTOMER_EXPORT_FIELDS}
        rows={exportRows}
        fileNamePrefix="customer"
      />
    </>
  );
}

function Kbd({ children, className }: { children: string; className?: string }) {
  return (
    <kbd className={cn("flex h-6 w-6 items-center justify-center rounded border bg-muted px-[6px] font-sans text-xs text-muted-foreground", className)}>
      {children}
    </kbd>
  );
}
