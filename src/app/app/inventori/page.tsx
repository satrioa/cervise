import { getInventori } from "@/app/app/inventori/actions";
import { InventoriClient } from "./inventori-client";
import { InventoriHeaderActions } from "@/components/inventori/inventori-header-actions";
import { PageHeader } from "@/components/layout/page-header";

export default async function InventoriPage() {
  // Query khusus inventori: seluruh katalog cabang aktif, bukan hasil pencarian
  // POS yang dipangkas 40 baris. Pengelompokan induk/varian ada di
  // lib/operational/inventori.ts supaya bisa diuji, bukan dihitung inline.
  const { groups, summary, truncated } = await getInventori();

  return (
    <div className="min-h-svh bg-background text-foreground">
      <PageHeader
        title="Inventori"
        titleClassName="font-heading text-2xl"
        description={`${summary.groups} produk induk · ${summary.varian} varian (Baru ${summary.baru} · Bekas ${summary.bekas})`}
        actions={<InventoriHeaderActions />}
      />
      <main className="mx-auto max-w-6xl px-6 py-6">
        <InventoriClient groups={groups} summary={summary} truncated={truncated} />
      </main>
    </div>
  );
}
