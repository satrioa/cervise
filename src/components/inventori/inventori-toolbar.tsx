"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { LayoutGridIcon, TableIcon } from "lucide-react";
import {
  INVENTORI_DEFAULTS,
  STOK_OPTIONS,
  TIPE_OPTIONS,
  type InventorySummary,
} from "@/lib/operational/inventori";

/** Tampilan inventori. Sama dengan `View` di inventori-client, dideklarasikan
 * ulang supaya toolbar tidak bergantung pada file client (circular import). */
type View = "kartu" | "tabel";

/**
 * Toolbar filter inventori.
 *
 * Filter berjalan di client, bukan lewat query: `getInventori` sudah
 * mengambil seluruh katalog cabang sekali jalan, jadi menyaring ulang di
 * server hanya menambah latency tanpa menambah data. Karena itu filter ditulis
 * ke URL (`q`, `tipe`, `stok`) supaya tetap bisa dibagikan dan bertahan saat
 * refresh, tapi tidak memicu perjalanan ke server data.
 */
export function InventoriToolbar({
  q: initialQ,
  tipe: initialTipe,
  stok: initialStok,
  view,
  onViewChange,
  shown,
  total,
  summary,
}: {
  q: string;
  tipe: string;
  stok: string;
  view: View;
  onViewChange: (view: View) => void;
  /** Jumlah varian yang lolos filter. */
  shown: number;
  /** Jumlah varian di katalog penuh. */
  total: number;
  /** Ringkasan hasil filter, untuk baris kedua. */
  summary: InventorySummary;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ref = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(initialQ);
  const [prev, setPrev] = useState(initialQ);
  // Filter bisa berubah dari luar (tombol Clear, atau tombol back browser),
  // jadi state lokal dikejar ulang supaya input tidak tertinggal di teks lama.
  if (initialQ !== prev) {
    setPrev(initialQ);
    setQ(initialQ);
  }

  const commit = useCallback(
    (next: { q?: string; tipe?: string; stok?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = {
        q: searchParams.get("q") ?? INVENTORI_DEFAULTS.q,
        tipe: searchParams.get("tipe") ?? INVENTORI_DEFAULTS.tipe,
        stok: searchParams.get("stok") ?? INVENTORI_DEFAULTS.stok,
      };
      const merged = { ...current, ...next };
      // Nilai default dihapus dari URL, bukan ditulis sebagai `?tipe=semua`,
      // supaya alamat yang dibagikan tetap bersih dan bisa dibaca.
      const setOrDel = (key: string, value: string, fallback: string) => {
        if (value && value !== fallback) params.set(key, value);
        else params.delete(key);
      };
      setOrDel("q", merged.q.trim(), INVENTORI_DEFAULTS.q);
      setOrDel("tipe", merged.tipe, INVENTORI_DEFAULTS.tipe);
      setOrDel("stok", merged.stok, INVENTORI_DEFAULTS.stok);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (q.trim() !== (searchParams.get("q") ?? "")) commit({ q });
    }, 300);
    return () => clearTimeout(timer);
  }, [q, commit, searchParams]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const el = event.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      event.preventDefault();
      ref.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const activeCount =
    (initialQ.trim() !== "" ? 1 : 0) +
    (initialTipe !== INVENTORI_DEFAULTS.tipe ? 1 : 0) +
    (initialStok !== INVENTORI_DEFAULTS.stok ? 1 : 0);

  const clear = () => {
    setQ("");
    commit({ q: "", tipe: INVENTORI_DEFAULTS.tipe, stok: INVENTORI_DEFAULTS.stok });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs/5">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-72">
          <InputGroupAddon>
            <SearchIcon className="size-4 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            ref={ref}
            placeholder="Cari nama, SKU, barcode, IMEI..."
            value={q}
            onChange={(event) => setQ(event.target.value)}
            nativeInput
            aria-label="Cari inventori"
          />
          <InputGroupAddon align="inline-end">
            <Kbd>/</Kbd>
          </InputGroupAddon>
        </InputGroup>
        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />
        <Select value={initialTipe} onValueChange={(value) => commit({ tipe: value ?? INVENTORI_DEFAULTS.tipe })}>
          <SelectTrigger className="w-36" size="sm">
            <SelectValue>
              {TIPE_OPTIONS.find((option) => option.value === initialTipe)?.label ?? "Semua tipe"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TIPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={initialStok} onValueChange={(value) => commit({ stok: value ?? INVENTORI_DEFAULTS.stok })}>
          <SelectTrigger className="w-40" size="sm">
            <SelectValue>
              {STOK_OPTIONS.find((option) => option.value === initialStok)?.label ?? "Semua stok"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STOK_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Switch tampilan memakai `Tabs` icon-only, sama seperti di /app/servis
            dan /app/penjualan, supaya toolbar ini konsisten dengan halaman lain.
            Diletakkan di kanan baris pertama, terpisah dari filter. */}
        <Tabs value={view} onValueChange={(value) => onViewChange(value as View)} className="ms-auto shrink-0">
          <TabsList>
            <TabsTrigger value="kartu" aria-label="Tampilan kartu" className="px-2.5">
              <LayoutGridIcon className="size-4" />
            </TabsTrigger>
            <TabsTrigger value="tabel" aria-label="Tampilan tabel" className="px-2.5">
              <TableIcon className="size-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <Separator />
      <div className="flex items-center gap-2">
        {/* Ringkasan ada di baris ini, bukan di baris terpisah: nilainya
            selalu mengikuti hasil filter, jadi harus seen di dekat kontrol yang
            mengubahnya. */}
        <span className="text-sm text-muted-foreground">
          {summary.groups} produk induk · {summary.varian} varian · {summary.totalStok} unit (Baru{" "}
          {summary.baru} · Bekas {summary.bekas})
          {summary.stokHabis > 0 ? ` · ${summary.stokHabis} varian stok habis` : ""}
        </span>
        <span className="ms-auto inline-flex items-center gap-1.5 text-muted-foreground text-xs">
          <span
            className={cn(
              "size-1.5 rounded-full",
              shown === 0 ? "bg-destructive" : activeCount > 0 ? "bg-amber-500" : "bg-emerald-500",
            )}
          />
          Menampilkan {shown} dari {total} varian
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

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="flex h-6 w-6 items-center justify-center rounded border bg-muted px-[6px] font-sans text-xs text-muted-foreground">
      {children}
    </kbd>
  );
}