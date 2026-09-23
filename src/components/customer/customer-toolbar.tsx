"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDownIcon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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

interface Props {
  query: string;
  status: string;
  sort: string;
  shown: number;
  total: number;
  exportRows: Record<string, any>[];
}

export function CustomerToolbar({ query: initialQuery, status: initialStatus, sort: initialSort, shown, total, exportRows }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const [query, setQuery] = useState(initialQuery);
  const [prevQuery, setPrevQuery] = useState(initialQuery);
  if (initialQuery !== prevQuery) {
    setPrevQuery(initialQuery);
    setQuery(initialQuery);
  }

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

  const status = initialStatus || CUSTOMER_DEFAULTS.status;
  const sort = initialSort || CUSTOMER_DEFAULTS.sort;

  const activeCount =
    (initialQuery ? 1 : 0) + (status !== CUSTOMER_DEFAULTS.status ? 1 : 0) + (sort !== CUSTOMER_DEFAULTS.sort ? 1 : 0);

  const clear = () => {
    setQuery("");
    commit({ q: "", status: CUSTOMER_DEFAULTS.status, sort: CUSTOMER_DEFAULTS.sort });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs/5">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-64">
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

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Select value={status} onValueChange={(v) => commit({ status: v ?? CUSTOMER_DEFAULTS.status })}>
          <SelectTrigger className="w-44" size="sm">
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
          <SelectTrigger className="w-48" size="sm">
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

        <div className="ms-auto flex items-center gap-2">
          <Button size="filter" variant="outline" onClick={() => setExportOpen(true)}>
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
        </div>
      </div>

      <Separator />

      <div className="flex items-center gap-2">
        <span className="ms-auto inline-flex items-center gap-1.5 text-muted-foreground text-xs">
          <span className={"size-1.5 rounded-full " + (shown === 0 ? "bg-destructive" : "bg-emerald-500")} />
          Menampilkan {shown} dari {total} customer
          {activeCount > 0 ? (
            <Button size="xs" variant="ghost" onClick={clear} className="-mr-2 h-6 px-1.5 text-muted-foreground">
              <XIcon /> Clear ({activeCount})
            </Button>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function Kbd({ children, className }: { children: string; className?: string }) {
  return (
    <kbd className={cn("flex h-6 w-6 items-center justify-center rounded border bg-muted px-[6px] font-sans text-xs text-muted-foreground", className)}>
      {children}
    </kbd>
  );
}
