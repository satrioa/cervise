import { searchProductsForSale } from "@/app/app/penjualan/actions";
import { InventoriClient } from "./inventori-client";
import { InventoriHeaderActions } from "@/components/inventori/inventori-header-actions";
import { PageHeader } from "@/components/layout/page-header";

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
      <PageHeader
        eyebrow="Inventori · Produk Gadget"
        title="Inventori"
        titleClassName="font-heading text-2xl"
        description={`${groups.length} produk induk · ${products.length} varian (Baru ${products.filter((p) => (p as any).variant_type === "BARU").length} · Bekas ${products.filter((p) => (p as any).variant_type === "BEKAS").length})`}
        actions={<InventoriHeaderActions />}
      />
      <main className="mx-auto max-w-6xl px-6 py-6">
        <InventoriClient groups={groups} />
      </main>
    </div>
  );
}
