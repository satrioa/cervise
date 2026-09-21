import { ArrowUpDownIcon, PlusIcon, ShoppingBagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

interface SparepartRow {
  sku: string;
  name: string;
  variant: string;
  category: string;
  price: number;
  stock: number;
  capacity: number;
  thumb: string;
  bg: string;
}

function stockTone(p: SparepartRow): { label: string; cls: string; barCls: string } {
  if (p.stock === 0) return { label: "Habis", cls: "border-destructive/30 text-destructive", barCls: "bg-destructive" };
  if (p.stock < 10) return { label: "Menipis", cls: "border-amber-500/30 text-amber-700 dark:text-amber-400", barCls: "bg-amber-500" };
  return { label: "Tersedia", cls: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400", barCls: "bg-emerald-500" };
}

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("cervise_spareparts").select("id,name,stock_qty,branch_id").limit(20);

  // Map DB rows to showcase rows; fallback mock if empty
  const PRODUCTS: SparepartRow[] = rows && rows.length > 0
    ? rows.map((r: any, idx) => ({
        sku: r.id.slice(0, 8).toUpperCase(),
        name: r.name,
        variant: `Stok cabang ${String(r.branch_id).slice(0,4)} · Hanya Admin`,
        category: idx % 2 === 0 ? "LCD" : "Baterai",
        price: [450000, 180000, 75000, 320000][idx % 4],
        stock: Number(r.stock_qty),
        capacity: 50,
        thumb: ["◐", "▲", "▭", "◇"][idx % 4],
        bg: ["from-amber-300/40 to-orange-500/30", "from-emerald-400/40 to-teal-600/30", "from-stone-300/50 to-stone-500/30", "from-violet-400/40 to-violet-600/30"][idx % 4],
      }))
    : [
        { sku: "SP-001", name: "LCD iPhone 11", variant: "Original · 6.1\"", category: "LCD", price: 450000, stock: 12, capacity: 30, thumb: "◐", bg: "from-amber-300/40 to-orange-500/30" },
        { sku: "SP-002", name: "Baterai Samsung A54", variant: "5000mAh · OEM", category: "Baterai", price: 180000, stock: 8, capacity: 30, thumb: "▲", bg: "from-emerald-400/40 to-teal-600/30" },
        { sku: "SP-003", name: "Flexi Cable Oppo", variant: "Flex main · Ori", category: "Flex", price: 75000, stock: 0, capacity: 20, thumb: "▭", bg: "from-stone-300/50 to-stone-500/30" },
        { sku: "SP-004", name: "Kaca Kamera Vivo", variant: "Lens · Dune", category: "Kaca", price: 95000, stock: 22, capacity: 40, thumb: "◯", bg: "from-rose-300/40 to-rose-600/30" },
      ];

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Operasional · Inventory</div>
            <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl">
              <ShoppingBagIcon className="size-5 text-muted-foreground" /> Inventory
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline">
              <ArrowUpDownIcon /> Sort: Stok rendah
            </Button>
            <Button size="sm">
              <PlusIcon /> Tambah Sparepart
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-10 py-8">
        <div className="rounded-xl border bg-card shadow-xs/5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">Sparepart</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="w-[280px]">Stok</TableHead>
                <TableHead className="pe-4 text-right">Harga Modal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PRODUCTS.map((p) => {
                const tone = stockTone(p);
                const pct = Math.min(100, Math.round((p.stock / p.capacity) * 100));
                return (
                  <TableRow key={p.sku}>
                    <TableCell className="ps-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={
                            "flex size-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br font-medium text-foreground/70 text-lg ring-1 ring-border/60 " + p.bg
                          }
                          aria-hidden
                        >
                          {p.thumb}
                        </div>
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-muted-foreground text-xs">{p.variant}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground text-xs">{p.sku}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <Badge variant="secondary" className="text-[11px]">{p.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                          <div className={"h-full " + tone.barCls} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono text-xs tabular-nums">
                          {p.stock}
                          <span className="text-muted-foreground/60">/{p.capacity}</span>
                        </span>
                        <Badge variant="outline" size="sm" className={"ml-1 " + tone.cls}>
                          {tone.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="pe-4 text-right font-mono tabular-nums">Rp {p.price.toLocaleString("id-ID")}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Style disalin dari <span className="font-mono">src/components/table-inventory.tsx:40</span> — SKU, kategori, stok bar, harga modal. Kategori & stok masuk/keluar next: tambah kolom `kategori` & log.</p>
      </main>
    </div>
  );
}
