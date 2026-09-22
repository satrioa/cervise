import { getKaryawan, getKaryawanBranches } from "./actions";
import { KaryawanToolbar, KARYAWAN_DEFAULTS } from "@/components/karyawan/karyawan-toolbar";
import type { ExportKaryawanRow } from "@/components/karyawan/export-karyawan-csv";
import { KaryawanHeaderActions, KaryawanList } from "@/components/karyawan/karyawan-list";

const ROLES: { label: string; value: string }[] = [
  { label: "Master Admin", value: "MASTER_ADMIN" },
  { label: "Admin", value: "ADMIN" },
  { label: "Frontliner", value: "FRONTLINER" },
  { label: "Teknisi", value: "TECHNICIAN" },
];

export default async function KaryawanPage({ searchParams }: { searchParams: Promise<{ q?: string; cabang?: string; role?: string; status?: string }> }) {
  const { q, cabang, role, status } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const cabangFilter = (cabang ?? "").trim() || KARYAWAN_DEFAULTS.cabang;
  const roleFilter = (role ?? "").trim() || KARYAWAN_DEFAULTS.role;
  const statusFilter = (status ?? "").trim().toLowerCase() || KARYAWAN_DEFAULTS.status;

  let rows: Awaited<ReturnType<typeof getKaryawan>> = [];
  let branches: { id: string; name: string }[] = [];
  try {
    [rows, branches] = await Promise.all([getKaryawan(), getKaryawanBranches()]);
  } catch {
    rows = [];
    branches = [];
  }

  const cabangs = branches.length ? branches.map((b) => b.name) : [...new Set(rows.map((k) => k.branchName).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "id"));

  const filtered = rows.filter((k) => {
    const hay = `${k.fullName} ${k.email ?? ""} ${k.phone ?? ""}`.toLowerCase();
    if (query && !hay.includes(query)) return false;
    if (cabangFilter !== KARYAWAN_DEFAULTS.cabang && (k.branchName ?? "—") !== cabangFilter) return false;
    if (roleFilter !== KARYAWAN_DEFAULTS.role && k.role !== roleFilter) return false;
    if (statusFilter !== KARYAWAN_DEFAULTS.status) {
      const wantAktif = statusFilter === "aktif";
      if (k.isActive !== wantAktif) return false;
    }
    return true;
  });

  const exportRows: ExportKaryawanRow[] = filtered.map((k) => ({
    name: k.fullName,
    email: k.email ?? k.phone ?? "—",
    cabang: k.branchName ?? "—",
    role: ROLES.find((r) => r.value === k.role)?.label ?? k.role,
    statusAktif: k.isActive ? "Aktif" : "Nonaktif",
    terakhirAktif: new Date(k.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
  }));

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Karyawan · {rows.length} orang · {branches.length || cabangs.length} cabang</div>
            <h1 className="mt-1 font-heading text-2xl">Data Karyawan</h1>
          </div>
          <KaryawanHeaderActions branches={branches} />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-10 py-8">
        <div className="mb-3">
          <KaryawanToolbar
            query={q?.trim() ?? ""}
            cabang={cabangFilter}
            role={roleFilter}
            status={statusFilter}
            cabangs={cabangs}
            shown={filtered.length}
            total={rows.length}
            exportRows={exportRows}
          />
        </div>
        <KaryawanList rows={filtered} branches={branches} />
        <p className="mt-3 text-xs text-muted-foreground">Email tersimpan di profiles.email · hapus karyawan ikut hapus login auth.</p>
      </main>
    </div>
  );
}
