import { listSessions } from "./actions";
import { OpnameClient } from "./opname-client";
import { PageHeader } from "@/components/layout/page-header";
import { getActiveTenant } from "@/lib/supabase/actor";
import { OPNAME_POSTER_ROLES } from "@/lib/operational/stock-opname";

export default async function OpnamePage() {
  const [products, spareparts, actor] = await Promise.all([
    listSessions("product"),
    listSessions("sparepart"),
    getActiveTenant(),
  ]);
  const canPost = OPNAME_POSTER_ROLES.includes(actor.role);

  return (
    <div className="min-h-svh bg-transparent text-foreground">
      <PageHeader
        title="Stock Opname"
        titleClassName="font-heading text-2xl"
        description="Hitung stok fisik, tinjau selisih, lalu posting penyesuaian."
      />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <OpnameClient products={products} spareparts={spareparts} canPost={canPost} />
      </main>
    </div>
  );
}
