import { getCabangList } from "./actions";
import { requireMenu } from "@/lib/auth/require-menu";
import { CabangClient } from "./cabang-client";
import { CabangHeaderActions } from "@/components/cabang/cabang-header-actions";
import { PageHeader } from "@/components/layout/page-header";

export default async function CabangPage() {
  const actor = await requireMenu("cabang");
  let branches: Awaited<ReturnType<typeof getCabangList>> = [];
  let loadError: string | null = null;
  try {
    branches = await getCabangList();
  } catch (e: any) {
    loadError = e?.message ?? "Gagal memuat cabang";
    branches = [];
  }

  // ADMIN read-only di halaman ini: RLS `branches_update` sudah mencabut
  // ADMIN, jadi tombol tambah/edit/hapus disembunyikan agar tidak
  // menawarkan aksi yang pasti ditolak.
  const canManage = actor.role.toUpperCase() !== "ADMIN";

  // Tidak ada fallback demo. Dulu daftar kosong diganti dua cabang palsu
  // ("Cervise Pusat", "Cervise Cabang 2") supaya halaman tidak terlihat
  // kosong, padahal data itu fiktif dan bisa disalin ke cabang sungguhan.
  // Daftar kosong yang jujur lebih berguna daripada isian palsu.
  const display = branches;
  const limit = 3;
  const total = display.length;
  const aktif = display.filter((b) => b.is_active).length;
  const nonaktif = total - aktif;

  return (
    <div className="min-h-svh bg-background">
      <PageHeader
        title="Cabang"
        description={`${total}/${limit} Cabang ● ${aktif} Aktif ● ${nonaktif} Nonaktif`}
        containerClassName="max-w-2xl"
        actions={canManage ? <CabangHeaderActions /> : null}
      />

      <div className="px-6 py-8">
        <div className="mx-auto max-w-2xl">
          {loadError && <p className="mb-3 text-xs text-destructive">{loadError} — coba refresh</p>}
          {!loadError && display.length === 0 && <p className="mb-3 text-xs text-muted-foreground">Belum ada cabang. Buat cabang pertama di bawah.</p>}
          <CabangClient branches={display} canManage={canManage} />
        </div>
      </div>
    </div>
  );
}
