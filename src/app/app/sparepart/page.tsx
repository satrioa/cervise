import { ClipboardCheckIcon, ShoppingBagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SparepartRevenue } from "@/components/sparepart/sparepart-revenue";
import { InventoryToolbar, INVENTORY_DEFAULTS, type InventoryView } from "@/components/sparepart/inventory-toolbar";
import { SparepartHeaderActions } from "@/components/sparepart/sparepart-header-actions";
import { SparepartList } from "@/components/sparepart/sparepart-list";
import { stockTone, type SparepartRow } from "@/components/sparepart/stock-tone";
import { getSpareparts } from "./actions";

function visualForCategory(cat: string): { thumb: string; bg: string } {
  const c = cat.toLowerCase();
  if (c.includes("lcd")) return { thumb: "◐", bg: "from-amber-300/40 to-orange-500/30" };
  if (c.includes("baterai")) return { thumb: "▲", bg: "from-emerald-400/40 to-teal-600/30" };
  if (c.includes("flex")) return { thumb: "▭", bg: "from-stone-300/50 to-stone-500/30" };
  if (c.includes("kaca")) return { thumb: "◯", bg: "from-rose-300/40 to-rose-600/30" };
  if (c.includes("ic") || c.includes("mesin")) return { thumb: "◇", bg: "from-violet-400/40 to-violet-600/30" };
  return { thumb: "⬡", bg: "from-sky-300/40 to-sky-600/30" };
}

export default async function SparepartPage({ searchParams }: { searchParams: Promise<{ q?: string; kat?: string; stok?: string; sort?: string; view?: string }> }) {
  const { q, kat, stok, sort, view } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const category = (kat ?? "").trim() || INVENTORY_DEFAULTS.category;
  const stock = (stok ?? "").trim().toLowerCase() || INVENTORY_DEFAULTS.stock;
  const sortKey = (sort ?? "").trim() || INVENTORY_DEFAULTS.sort;
  const viewKey: InventoryView = view === "grid" ? "grid" : "tabel";

  let live: Awaited<ReturnType<typeof getSpareparts>> = [];
  try {
    live = await getSpareparts();
  } catch {
    live = [];
  }

  const PRODUCTS: SparepartRow[] = live.length
    ? live
        .filter((r) => r.is_active)
        .map((r) => {
          const vis = visualForCategory(r.category);
          const priceRp = Math.floor(r.cost_cents / 100);
          const capacity = Math.max(10, Math.ceil(Math.max(r.qty, r.min_stock || 0, 10) * 1.5));
          return {
            id: r.id,
            sku: r.sku,
            name: r.name,
            variant: `${r.unit} · ${r.category}`,
            category: r.category,
            price: priceRp,
            stock: r.qty,
            capacity,
            thumb: vis.thumb,
            bg: vis.bg,
            is_active: r.is_active,
            unit: r.unit,
            cost_cents: r.cost_cents,
            price_cents: r.price_cents,
            min_stock: r.min_stock,
          };
        })
    : [
        { sku: "SP-001", name: "LCD iPhone 11", variant: "pcs · LCD", category: "LCD", price: 450000, stock: 12, capacity: 30, thumb: "◐", bg: "from-amber-300/40 to-orange-500/30" },
        { sku: "SP-002", name: "Baterai Samsung A54", variant: "pcs · Baterai", category: "Baterai", price: 180000, stock: 8, capacity: 30, thumb: "▲", bg: "from-emerald-400/40 to-teal-600/30" },
        { sku: "SP-003", name: "Flexi Cable Oppo", variant: "pcs · Flex", category: "Flex", price: 75000, stock: 0, capacity: 20, thumb: "▭", bg: "from-stone-300/50 to-stone-500/30" },
        { sku: "SP-004", name: "Kaca Kamera Vivo", variant: "pcs · Kaca", category: "Kaca", price: 95000, stock: 22, capacity: 40, thumb: "◯", bg: "from-rose-300/40 to-rose-600/30" },
      ];

  const categories = [...new Set(PRODUCTS.map((p) => p.category))].sort((a, b) => a.localeCompare(b, "id"));

  const filtered = PRODUCTS.filter((p) => {
    if (query && !`${p.name} ${p.sku} ${p.category} ${p.variant}`.toLowerCase().includes(query)) return false;
    if (category !== INVENTORY_DEFAULTS.category && p.category !== category) return false;
    if (stock !== INVENTORY_DEFAULTS.stock && stockTone(p).label.toLowerCase() !== stock) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case "harga-desc":
        return b.price - a.price;
      case "harga-asc":
        return a.price - b.price;
      case "nama":
        return a.name.localeCompare(b.name, "id");
      case "stok-rendah":
      default:
        return a.stock - b.stock;
    }
  });

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Operasional · Sparepart</div>
            <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl">
              <ShoppingBagIcon className="size-5 text-muted-foreground" /> Sparepart
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled title="Segera hadir — stok opname per cabang + selisih & berita acara">
              <ClipboardCheckIcon /> Stok Opname
              <span className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Segera hadir</span>
            </Button>
            <SparepartHeaderActions categories={categories} />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-10 py-8">
        <SparepartRevenue />
        <div className="mt-6 mb-3">
          <InventoryToolbar
            query={q?.trim() ?? ""}
            category={category}
            stock={stock}
            sort={sortKey}
            view={viewKey}
            categories={categories}
            shown={sorted.length}
            total={PRODUCTS.length}
            exportRows={sorted}
          />
        </div>
        <SparepartList rows={sorted} categories={categories} view={viewKey} />
        <p className="mt-3 text-xs text-muted-foreground">SKU otomatis SP-XXX · stok per cabang · Harga Modal dari cost_cents.</p>
      </main>
    </div>
  );
}
