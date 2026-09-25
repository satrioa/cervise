import { ShoppingBagIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchProductsForSale } from "@/app/app/penjualan/actions";
import { InventoriClient } from "./inventori-client";

export default async function InventoriPage() {
  let products: Awaited<ReturnType<typeof searchProductsForSale>> = [];
  try {
    products = await searchProductsForSale("");
  } catch {
    products = [];
  }

  // group by parent_key or name slug
  const grouped = new Map<string, typeof products>();
  for (const p of products) {
    const key = (p as any).parent_key || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

  const groups = Array.from(grouped.entries()).map(([key, items]) => {
    const name = items[0].name;
    const totalStok = items.reduce((a, b) => a + (b.stock_qty ?? 0), 0);
    const baru = items.filter((i) => (i as any).variant_type === "BARU");
    const bekas = items.filter((i) => (i as any).variant_type === "BEKAS");
    return { key, name, items, totalStok, baru, bekas };
  });

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Inventori · Produk Gadget</div>
            <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl">
              <ShoppingBagIcon className="size-5 text-muted-foreground" /> Inventori
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{groups.length} produk induk · {products.length} varian (Baru {products.filter((p) => (p as any).variant_type === "BARU").length} · Bekas {products.filter((p) => (p as any).variant_type === "BEKAS").length})</p>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-6 py-6">
        <InventoriClient groups={groups} />
      </main>
    </div>
  );
}
