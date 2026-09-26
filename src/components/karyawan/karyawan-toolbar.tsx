"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
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

function useKaryawanCommit() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  return { commit };
}

export function KaryawanSearch({ query: initialQuery }: { query: string }) {
  const { commit } = useKaryawanCommit();
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
  );
}

export function KaryawanFilters({
  query,
  cabang: initialCabang,
  role: initialRole,
  status: initialStatus,
  cabangs,
}: {
  query: string;
  cabang: string;
  role: string;
  status: string;
  cabangs: string[];
}) {
  const { commit } = useKaryawanCommit();

  const cabang = initialCabang || KARYAWAN_DEFAULTS.cabang;
  const role = initialRole || KARYAWAN_DEFAULTS.role;
  const status = initialStatus || KARYAWAN_DEFAULTS.status;

  const activeCount =
    (query ? 1 : 0) +
    (cabang !== KARYAWAN_DEFAULTS.cabang ? 1 : 0) +
    (role !== KARYAWAN_DEFAULTS.role ? 1 : 0) +
    (status !== KARYAWAN_DEFAULTS.status ? 1 : 0);

  const clear = () => {
    commit({ q: "", cabang: KARYAWAN_DEFAULTS.cabang, role: KARYAWAN_DEFAULTS.role, status: KARYAWAN_DEFAULTS.status });
  };

  return (
    <>
      <Select value={cabang} onValueChange={(v) => commit({ cabang: v ?? KARYAWAN_DEFAULTS.cabang })}>
        <SelectTrigger className="w-40 shrink-0" size="sm">
          <SelectValue>{cabang === KARYAWAN_DEFAULTS.cabang ? "Semua cabang" : cabang}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          <SelectItem value="semua">Semua cabang</SelectItem>
          {cabangs.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectPopup>
      </Select>

      <Select value={role} onValueChange={(v) => commit({ role: v ?? KARYAWAN_DEFAULTS.role })}>
        <SelectTrigger className="w-36 shrink-0" size="sm">
          <SelectValue>{ROLE_OPTIONS.find((o) => o.value === role)?.label ?? "Semua role"}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectPopup>
      </Select>

      <Select value={status} onValueChange={(v) => commit({ status: v ?? KARYAWAN_DEFAULTS.status })}>
        <SelectTrigger className="w-32 shrink-0" size="sm">
          <SelectValue>{STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "Semua status"}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
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

export function KaryawanExportButton({ exportRows }: { exportRows: Record<string, any>[] }) {
  const [exportOpen, setExportOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => setExportOpen(true)}>
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
