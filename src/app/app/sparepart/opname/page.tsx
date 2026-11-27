import { requireMenu } from "@/lib/auth/require-menu";
import { PageHeader } from "@/components/layout/page-header";
import { OPNAME_POSTER_ROLES } from "@/lib/operational/stock-opname";
import { OpnameClient } from "../../inventori/opname/opname-client";
import { listSessions } from "../../inventori/opname/actions";

export default async function Page() {
  const [sessions, actor] = await Promise.all([
    listSessions("sparepart"),
    requireMenu("kategori_sparepart"),
  ]);
  const canPost = OPNAME_POSTER_ROLES.includes(actor.role);

  return (
    <div className="min-h-svh bg-transparent text-foreground">
      <PageHeader
        title="Stock Opname Sparepart"
        titleClassName="font-heading text-2xl"
        description="Hitung stok fisik sparepart, tinjau selisih, lalu posting penyesuaian."
        containerClassName="max-w-4xl"
      />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <OpnameClient
          lockedDomain="sparepart"
          products={[]}
          spareparts={sessions}
          canPost={canPost}
        />
      </main>
    </div>
  );
}
