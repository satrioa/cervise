"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpDownIcon,
  LayoutGridIcon,
  SearchIcon,
  TableIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type InventoryView = "tabel" | "grid";

export const INVENTORY_DEFAULTS = {
  query: "",
  category: "semua",
  stock: "semua",
  sort: "stok-rendah",
  view: "tabel" as InventoryView,
};

const STOCK_OPTIONS = [
  { label: "Semua status", value: "semua" },
  { label: "Tersedia", value: "tersedia" },
  { label: "Menipis", value: "menipis" },
  { label: "Habis", value: "habis" },
];

const SORT_OPTIONS = [
  { label: "Stok rendah", value: "stok-rendah" },
  { label: "Harga tertinggi", value: "harga-desc" },
  { label: "Harga termurah", value: "harga-asc" },
  { label: "Nama A–Z", value: "nama" },
];

function useInventoryCommit() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const commit = useCallback((next: { q?: string; kat?: string; stok?: string; sort?: string; view?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    const current = {
      q: searchParams.get("q") ?? "",
      kat: searchParams.get("kat") ?? INVENTORY_DEFAULTS.category,
      stok: searchParams.get("stok") ?? INVENTORY_DEFAULTS.stock,
      sort: searchParams.get("sort") ?? INVENTORY_DEFAULTS.sort,
      view: searchParams.get("view") ?? INVENTORY_DEFAULTS.view,
    };
    const merged = { ...current, ...next };
    const setOrDelete = (key: string, value: string, def: string) => {
      if (value && value !== def) params.set(key, value);
      else params.delete(key);
    };
    setOrDelete("q", merged.q.trim(), "");
    setOrDelete("kat", merged.kat, INVENTORY_DEFAULTS.category);
    setOrDelete("stok", merged.stok, INVENTORY_DEFAULTS.stock);
    setOrDelete("sort", merged.sort, INVENTORY_DEFAULTS.sort);
    setOrDelete("view", merged.view, INVENTORY_DEFAULTS.view);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return { commit };
}

export function InventorySearch({ query: initialQuery }: { query: string }) {
  const { commit } = useInventoryCommit();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(initialQuery);
  const [prevQuery, setPrevQuery] = useState(initialQuery);
  if (initialQuery !== prevQuery) {
    setPrevQuery(initialQuery);
    setQuery(initialQuery);
  }

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      const paramQ = searchParams.get("q") ?? "";
      if (query.trim() !== paramQ) commit({ q: query });
    }, 300);
    return () => clearTimeout(t);
  }, [query, commit, searchParams]);

  // "/" focuses search
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
        placeholder="Cari nama, SKU, kategori…"
        aria-label="Cari sparepart"
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

export function InventoryFilters({
  query,
  category: initialCategory,
  stock: initialStock,
  sort: initialSort,
  view: initialView,
  categories,
}: {
  query: string;
  category: string;
  stock: string;
  sort: string;
  view: InventoryView;
  categories: string[];
}) {
  const { commit } = useInventoryCommit();

  const category = initialCategory || INVENTORY_DEFAULTS.category;
  const stock = initialStock || INVENTORY_DEFAULTS.stock;
  const sort = initialSort || INVENTORY_DEFAULTS.sort;
  const view = initialView || INVENTORY_DEFAULTS.view;

  const activeCount =
    (query ? 1 : 0) +
    (category !== INVENTORY_DEFAULTS.category ? 1 : 0) +
    (stock !== INVENTORY_DEFAULTS.stock ? 1 : 0) +
    (sort !== INVENTORY_DEFAULTS.sort ? 1 : 0);

  const clear = () => {
    commit({ q: "", kat: INVENTORY_DEFAULTS.category, stok: INVENTORY_DEFAULTS.stock, sort: INVENTORY_DEFAULTS.sort });
  };

  return (
    <>
      <Select value={category} onValueChange={(v) => commit({ kat: v ?? INVENTORY_DEFAULTS.category })}>
        <SelectTrigger className="w-36 shrink-0" size="sm">
          <SelectValue>{category === INVENTORY_DEFAULTS.category ? "Semua kategori" : category}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          <SelectItem value="semua">Semua kategori</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>

      <Select value={stock} onValueChange={(v) => commit({ stok: v ?? INVENTORY_DEFAULTS.stock })}>
        <SelectTrigger className="w-32 shrink-0" size="sm">
          <SelectValue>{STOCK_OPTIONS.find((s) => s.value === stock)?.label ?? "Semua status"}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {STOCK_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>

      <Select value={sort} onValueChange={(v) => commit({ sort: v ?? INVENTORY_DEFAULTS.sort })}>
        <SelectTrigger className="w-44 shrink-0" size="sm">
          <ArrowUpDownIcon className="text-muted-foreground" />
          <SelectValue>{SORT_OPTIONS.find((s) => s.value === sort)?.label ?? "Stok rendah"}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {SORT_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>

      <ToggleGroup
        value={[view]}
        onValueChange={(v) => {
          const next = (v as string[])[0];
          if (next === "tabel" || next === "grid") commit({ view: next });
        }}
        aria-label="Tampilan"
        className="shrink-0"
      >
        <ToggleGroupItem value="tabel" size="sm" aria-label="Tabel">
          <TableIcon />
        </ToggleGroupItem>
        <ToggleGroupItem value="grid" size="sm" aria-label="Grid">
          <LayoutGridIcon />
        </ToggleGroupItem>
      </ToggleGroup>

      {activeCount > 0 ? (
        <Button size="xs" variant="ghost" onClick={clear} className="h-8 shrink-0 px-1.5 text-muted-foreground">
          <XIcon /> Clear ({activeCount})
        </Button>
      ) : null}
    </>
  );
}

function Kbd({ children, className }: { children: string; className?: string }) {
  return (
    <kbd
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded border bg-muted px-[6px] font-sans text-xs text-muted-foreground",
        className
      )}
    >
      {children}
    </kbd>
  );
}
