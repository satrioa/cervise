"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ProductVariantDialog } from "@/components/inventori/product-variant-dialog";
import { formatCurrencyPlain } from "@/lib/format";
import { useRouter } from "next/navigation";
import { PackageIcon, SmartphoneIcon } from "lucide-react";

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock_qty: number;
  cost: number;
  price: number;
  variant_type: "BARU" | "BEKAS";
  storage: string | null;
  warna: string | null;
  bh_percent: number | null;
  kondisi_notes: string | null;
  garansi_days: number | null;
  imei: string | null;
  parent_key: string | null;
};

type Group = {
  key: string;
  name: string;
  items: ProductRow[];
  totalStok: number;
  baru: ProductRow[];
  bekas: ProductRow[];
};

export function InventoriClient({ groups }: { groups: Group[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <PackageIcon className="size-4" /> Tambah Produk / Varian
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/40 p-12 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <SmartphoneIcon className="size-6 text-muted-foreground" />
          </div>
          <p className="mt-3 font-medium">Belum ada produk</p>
          <p className="text-sm text-muted-foreground">Tambah varian Baru (warna+storage) atau Bekas (IMEI) untuk mulai.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.key} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{g.name}</CardTitle>
                    <CardDescription>
                      Total stok {g.totalStok} · Baru {g.baru.length} varian ({g.baru.reduce((a, b) => a + b.stock_qty, 0)} unit) · Bekas {g.bekas.length} unit ({g.bekas.filter((b) => b.stock_qty > 0).length} tersedia)
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">{g.items.length} varian</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {g.baru.length > 0 && (
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Baru — Varian warna & storage (stok agregat)</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {g.baru.map((v) => (
                        <div key={v.id} className="flex gap-3 rounded-lg border bg-card p-3">
                          <div className="flex size-10 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
                            <PackageIcon className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{v.storage} • {v.warna}</div>
                            <div className="font-mono text-xs text-muted-foreground truncate">{v.sku}</div>
                            <div className="mt-1 flex items-center gap-2">
                              <Badge variant="outline" size="sm" className={v.stock_qty === 0 ? "border-destructive text-destructive" : v.stock_qty < 3 ? "border-amber-500 text-amber-700" : "border-emerald-500 text-emerald-700"}>
                                Stok {v.stock_qty}
                              </Badge>
                              <span className="font-mono text-xs">{formatCurrencyPlain(v.price)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {g.bekas.length > 0 && (
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Bekas — Per IMEI (stok 1 per unit)</div>
                    <div className="space-y-2">
                      {g.bekas.map((v) => (
                        <div key={v.id} className={`flex gap-3 rounded-lg border p-3 ${v.stock_qty === 0 ? "opacity-50 bg-muted/20" : "bg-amber-500/5 border-amber-500/20"}`}>
                          <div className="flex size-10 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 shrink-0">
                            <SmartphoneIcon className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-xs font-medium truncate">{v.imei} • {v.storage} • {v.warna} • BH {v.bh_percent}%</div>
                            <div className="text-xs text-muted-foreground truncate">{v.kondisi_notes || "Tanpa notes"} {v.garansi_days ? `· Garansi ${v.garansi_days}hr` : "· Tanpa garansi"}</div>
                            <div className="font-mono text-xs truncate">{v.sku} • Rp {v.cost.toLocaleString("id-ID")} → Rp {v.price.toLocaleString("id-ID")}</div>
                          </div>
                          <Badge variant="outline" size="sm" className={v.stock_qty > 0 ? "border-emerald-500 text-emerald-700" : "border-zinc-400 text-zinc-500"}>{v.stock_qty > 0 ? "Tersedia" : "Terjual"}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProductVariantDialog open={open} onOpenChange={setOpen} onSuccess={() => router.refresh()} />
    </>
  );
}
