"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { GenericExportDialog, type ExportField } from "@/components/generic-export-dialog";

export const KARYAWAN_DEFAULTS = {
  query: "",
  cabang: "semua",
  role: "semua",
  status: "semua",
};

const ROLE_OPTIONS = [
  { label: "Semua role", value: "semua" },
  { label: "Master Admin", value: "master_admin" },
  { label: "Admin", value: "admin" },
  { label: "Frontliner", value: "frontliner" },
  { label: "Teknisi", value: "teknisi" },
];

const STATUS_OPTIONS = [
  { label: "Semua status", value: "semua" },
  { label: "Aktif", value: "aktif" },
  { label: "Nonaktif", value: "nonaktif" },
];

const KARYAWAN_EXPORT_FIELDS: ExportField[] = [
  { id: "name", label: "Nama", default: true },
  { id: "email", label: "Email", default: true },
  { id: "cabang", label: "Cabang", default: true },
  { id: "role", label: "Role", default: true },
  { id: "statusAktif", label: "Status", default: false },
  { id: "terakhirAktif", label: "Terakhir Aktif", default: false },
];

interface Props {
  query: string;
  cabang: string;
  role: string;
  status: string;
  cabangs: string[];
  shown: number;
  total: number;
  exportRows: Record<string, any>[];
}

export function KaryawanToolbar({
  query: initialQuery,
  cabang: initialCabang,
  role: initialRole,
  status: initialStatus,
  cabangs,
  shown,
  total,
  exportRows,
}: Props) {
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

  const commit = useCallback((next: { q?: string; cabang?: string; role?: string; status?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    const current = {
      q: searchParams.get("q") ?? "",
      cabang: searchParams.get("cabang") ?? KARYAWAN_DEFAULTS.cabang,
      role: searchParams.get("role") ?? KARYAWAN_DEFAULTS.role,
      status: searchParams.get("status") ?? KARYAWAN_DEFAULTS.status,
    };
    const merged = { ...current, ...next };
    const setOrDelete = (key: string, value: string, def: string) => {
      if (value && value !== def) params.set(key, value);
      else params.delete(key);
    };
    setOrDelete("q", merged.q.trim(), "");
    setOrDelete("cabang", merged.cabang, KARYAWAN_DEFAULTS.cabang);
    setOrDelete("role", merged.role, KARYAWAN_DEFAULTS.role);
    setOrDelete("status", merged.status, KARYAWAN_DEFAULTS.status);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

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

  const cabang = initialCabang || KARYAWAN_DEFAULTS.cabang;
  const role = initialRole || KARYAWAN_DEFAULTS.role;
  const status = initialStatus || KARYAWAN_DEFAULTS.status;

  const activeCount =
    (initialQuery ? 1 : 0) +
    (cabang !== KARYAWAN_DEFAULTS.cabang ? 1 : 0) +
    (role !== KARYAWAN_DEFAULTS.role ? 1 : 0) +
    (status !== KARYAWAN_DEFAULTS.status ? 1 : 0);

  const clear = () => {
    setQuery("");
    commit({ q: "", cabang: KARYAWAN_DEFAULTS.cabang, role: KARYAWAN_DEFAULTS.role, status: KARYAWAN_DEFAULTS.status });
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
            placeholder="Cari nama, email…"
            aria-label="Cari karyawan"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            nativeInput
          />
          <InputGroupAddon align="inline-end">
            <Kbd>/</Kbd>
          </InputGroupAddon>
        </InputGroup>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Select value={cabang} onValueChange={(v) => commit({ cabang: v ?? KARYAWAN_DEFAULTS.cabang })}>
          <SelectTrigger className="w-40" size="sm">
            <SelectValue>{cabang === KARYAWAN_DEFAULTS.cabang ? "Semua cabang" : cabang}</SelectValue>
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="semua">Semua cabang</SelectItem>
            {cabangs.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectPopup>
        </Select>

        <Select value={role} onValueChange={(v) => commit({ role: v ?? KARYAWAN_DEFAULTS.role })}>
          <SelectTrigger className="w-36" size="sm">
            <SelectValue>{ROLE_OPTIONS.find((o) => o.value === role)?.label ?? "Semua role"}</SelectValue>
          </SelectTrigger>
          <SelectPopup>
            {ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectPopup>
        </Select>

        <Select value={status} onValueChange={(v) => commit({ status: v ?? KARYAWAN_DEFAULTS.status })}>
          <SelectTrigger className="w-32" size="sm">
            <SelectValue>{STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "Semua status"}</SelectValue>
          </SelectTrigger>
          <SelectPopup>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectPopup>
        </Select>

        <div className="ms-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
            Export
          </Button>
          <GenericExportDialog
            open={exportOpen}
            onOpenChange={setExportOpen}
            title="Export Karyawan"
            description="Unduh data karyawan terfilter."
            fields={KARYAWAN_EXPORT_FIELDS}
            rows={exportRows}
            fileNamePrefix="karyawan"
          />
        </div>
      </div>

      <Separator />

      <div className="flex items-center gap-2">
        <span className="ms-auto inline-flex items-center gap-1.5 text-muted-foreground text-xs">
          <span className={"size-1.5 rounded-full " + (shown === 0 ? "bg-destructive" : "bg-emerald-500")} />
          Menampilkan {shown} dari {total} karyawan
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
