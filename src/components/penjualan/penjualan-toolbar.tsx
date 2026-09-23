"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export const PENJUALAN_DEFAULTS = { q: "", metode: "semua", status: "semua" };

const METODE_OPTIONS = [
  { label: "Semua metode", value: "semua" },
  { label: "Tunai", value: "Tunai" },
  { label: "Debit", value: "Debit" },
  { label: "Transfer", value: "Transfer" },
  { label: "QRIS", value: "QRIS" },
  { label: "E-Wallet", value: "E-Wallet" },
];

const STATUS_OPTIONS = [
  { label: "Semua status", value: "semua" },
  { label: "Selesai", value: "selesai" },
  { label: "Retur", value: "retur" },
];

export function PenjualanToolbar({ q: initialQ, metode: initialMetode, status: initialStatus, shown, total }: { q: string; metode: string; status: string; shown: number; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ref = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(initialQ);
  const [prev, setPrev] = useState(initialQ);
  if (initialQ !== prev) { setPrev(initialQ); setQ(initialQ); }

  const commit = useCallback((next: { q?: string; metode?: string; status?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    const cur = { q: searchParams.get("q") ?? "", metode: searchParams.get("metode") ?? "semua", status: searchParams.get("status") ?? "semua" };
    const merged = { ...cur, ...next };
    const setOrDel = (k: string, v: string, d: string) => { if (v && v !== d) params.set(k, v); else params.delete(k); };
    setOrDel("q", merged.q.trim(), "");
    setOrDel("metode", merged.metode, "semua");
    setOrDel("status", merged.status, "semua");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const t = setTimeout(() => { if (q.trim() !== (searchParams.get("q") ?? "")) commit({ q }); }, 300);
    return () => clearTimeout(t);
  }, [q, commit, searchParams]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault(); ref.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const activeCount = (initialQ ? 1 : 0) + (initialMetode !== "semua" ? 1 : 0) + (initialStatus !== "semua" ? 1 : 0);
  const clear = () => { setQ(""); commit({ q: "", metode: "semua", status: "semua" }); };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs/5">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-64">
          <InputGroupAddon><SearchIcon className="size-4 text-muted-foreground" /></InputGroupAddon>
          <InputGroupInput ref={ref} placeholder="Cari nota, customer, SKU / scan barcode…" value={q} onChange={(e) => setQ(e.target.value)} nativeInput aria-label="Cari penjualan" />
          <InputGroupAddon align="inline-end"><Kbd>/</Kbd></InputGroupAddon>
        </InputGroup>
        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />
        <Select value={initialMetode} onValueChange={(v) => commit({ metode: v ?? "semua" })}>
          <SelectTrigger className="w-36" size="sm"><SelectValue>{METODE_OPTIONS.find((x) => x.value === initialMetode)?.label ?? "Semua metode"}</SelectValue></SelectTrigger>
          <SelectContent>{METODE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={initialStatus} onValueChange={(v) => commit({ status: v ?? "semua" })}>
          <SelectTrigger className="w-32" size="sm"><SelectValue>{STATUS_OPTIONS.find((x) => x.value === initialStatus)?.label ?? "Semua status"}</SelectValue></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Separator />
      <div className="flex items-center gap-2">
        <span className="ms-auto inline-flex items-center gap-1.5 text-muted-foreground text-xs">
          <span className={"size-1.5 rounded-full " + (shown === 0 ? "bg-destructive" : "bg-emerald-500")} />
          Menampilkan {shown} dari {total} penjualan
          {activeCount > 0 ? <Button size="xs" variant="ghost" onClick={clear} className="-mr-2 h-6 px-1.5 text-muted-foreground"><XIcon /> Clear ({activeCount})</Button> : null}
        </span>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd className={cn("flex h-6 w-6 items-center justify-center rounded border bg-muted px-[6px] font-sans text-xs text-muted-foreground")}>{children}</kbd>;
}
