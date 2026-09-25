import { getCabangList } from "./actions";
import { CabangClient } from "./cabang-client";
import { CabangHeaderActions } from "@/components/cabang/cabang-header-actions";
import { PageHeader } from "@/components/layout/page-header";

export default async function CabangPage() {
  let branches: Awaited<ReturnType<typeof getCabangList>> = [];
  let loadError: string | null = null;
  try {
    branches = await getCabangList();
  } catch (e: any) {
    loadError = e?.message ?? "Gagal memuat cabang";
    branches = [];
  }

  // Wire up: show real data; fallback demo only when unauthenticated/empty and no error
  const isDemo = branches.length === 0 && !loadError;
  const display = isDemo
    ? [
        { id: "mock-1", name: "Cervise Pusat", city: "Jl. Merdeka No.1", phone: "081211111111", is_active: true, is_intensif_enabled: true, intensif_mode: "percent" as const, intensif_value: 5, intensif_target_count: 15, created_at: new Date().toISOString(), teknisiCount: 3 },
        { id: "mock-2", name: "Cervise Cabang 2", city: "Jl. Pahlawan No.5", phone: "081222222222", is_active: true, is_intensif_enabled: true, intensif_mode: "fixed" as const, intensif_value: 50000, intensif_target_count: 10, created_at: new Date(Date.now() - 86400000 * 2).toISOString(), teknisiCount: 2 },
      ]
    : branches;

  const limit = 3;
  const total = display.length;
  const aktif = display.filter((b) => b.is_active).length;
  const nonaktif = total - aktif;

  return (
    <div className="min-h-svh bg-background">
      <PageHeader
        title="Cabang"
        description={`${total}/${limit} Cabang ● ${aktif} Aktif ● ${nonaktif} Nonaktif${isDemo ? " · Demo" : ""}`}
        innerClassName="max-w-2xl"
        actions={<CabangHeaderActions />}
      />

      <div className="px-6 py-8">
        <div className="mx-auto max-w-2xl">
          {loadError && <p className="mb-3 text-xs text-destructive">{loadError} — {isDemo ? "menampilkan data demo" : "coba refresh"}</p>}
          {!loadError && display.length === 0 && <p className="mb-3 text-xs text-muted-foreground">Belum ada cabang. Buat cabang pertama di bawah.</p>}
          <CabangClient branches={display} isDemo={isDemo} />
        </div>
      </div>
    </div>
  );
}
