import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ACCESS_STATUSES, filterTenants, type TenantRow } from "./tenant-directory";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const directory = read("src/components/owner/tenant-directory.tsx");
const page = read("src/app/owner/tenants/page.tsx");

function tenant(overrides: Partial<TenantRow> = {}): TenantRow {
  return {
    id: "id",
    name: "JCellular",
    slug: "jcellular",
    status: "active",
    owner_email: "owner@jcellular.id",
    package: { name: "Business", branch_limit: 5 },
    subscriptionStatus: "active",
    accessState: "active",
    effectivePrice: 999000,
    activeBranchCount: 2,
    trialEndsAt: null,
    currentPeriodEnd: "2026-12-01T00:00:00Z",
    ...overrides,
  };
}

const all = [
  tenant(),
  tenant({ id: "b", name: "Sinar", slug: "sinar", owner_email: "sinar@example.com", accessState: "trial", package: { name: "Starter", branch_limit: 1 } }),
  tenant({ id: "c", name: "Kaggo Cabang", slug: "kaggo-cabang", owner_email: null, accessState: "grace", package: null }),
];

describe("filterTenants", () => {
  it("filter checklist status memakai accessState", () => {
    expect(filterTenants(all, { statuses: ["trial"], packageName: "all", query: "" }).map((t) => t.id)).toEqual(["b"]);
    expect(filterTenants(all, { statuses: [...ACCESS_STATUSES], packageName: "all", query: "" })).toHaveLength(3);
  });

  it("filter paket tunggal, 'all' tidak menyaring", () => {
    expect(filterTenants(all, { statuses: [...ACCESS_STATUSES], packageName: "Business", query: "" }).map((t) => t.id)).toEqual(["id"]);
    expect(filterTenants(all, { statuses: [...ACCESS_STATUSES], packageName: "all", query: "" })).toHaveLength(3);
  });

  it("search mencocokkan nama, slug, dan email owner secara case-insensitive", () => {
    const options = { statuses: [...ACCESS_STATUSES], packageName: "all" };
    expect(filterTenants(all, { ...options, query: "SINAR" }).map((t) => t.id)).toEqual(["b"]);
    expect(filterTenants(all, { ...options, query: "kaggo-cabang" }).map((t) => t.id)).toEqual(["c"]);
    expect(filterTenants(all, { ...options, query: "owner@jcellular" }).map((t) => t.id)).toEqual(["id"]);
  });
});

describe("Halaman Tenants", () => {
  it("memisahkan tenant aktif dan arsip", () => {
    expect(page).toMatch(/tenant\.status !== "cancelled"/);
    expect(page).toMatch(/tenant\.status === "cancelled"/);
    expect(page).toContain("archivedTenants={archivedTenants}");
  });

  it("memakai coss CardFrame untuk kedua tabel", () => {
    expect(directory).toContain("CardFrame");
    expect(directory).toContain("CardFrameHeader");
    expect(directory).toContain("CardFrameFooter");
    expect((directory.match(/<CardFrame>/g) ?? []).length).toBe(2);
  });

  it("memiliki search, checklist status, filter paket, dan pagination", () => {
    expect(directory).toContain('aria-label="Cari tenant"');
    expect(directory).toContain("tenant-status-${status}");
    expect(directory).toContain('id="tenant-package"');
    expect(directory).toContain("<Pagination");
    expect(directory).toContain("Per halaman");
  });

  it("tombol hapus permanen hanya di tabel arsip, di kolom tenant", () => {
    expect(directory).toContain('aria-label={`Hapus permanen ${tenant.name}`}');
    expect(directory).toContain('onDelete={setDeletingTenant}');
    expect(directory).toContain('<TenantTable tenants={pageItems} emptyLabel="Tidak ada tenant yang cocok." />');
  });

  it("dialog konfirmasi meminta ketik nama tenant", () => {
    expect(directory).toContain('id="confirm-delete-tenant"');
    expect(directory).toContain("deleteConfirm.trim() !== deletingTenant.name.trim()");
    expect(directory).toContain("Tidak bisa dibatalkan");
    expect(directory).toContain("deleteTenantPermanently({");
  });
});

describe("deleteTenantPermanently", () => {
  const action = () => {
    const actions = read("src/app/owner/actions.ts");
    const start = actions.indexOf("export async function deleteTenantPermanently");
    return actions.slice(start, start + 1700);
  };

  it("hanya platform admin, lewat admin client (authenticated tidak punya grant DELETE)", () => {
    expect(action()).toContain("requirePlatformAdmin()");
    expect(action()).toContain("const admin = createAdminClient();");
    expect(action()).toMatch(/admin\.from\("organizations"\)\.delete\(\)/);
  });

  it("guard: hanya tenant cancelled dan nama harus cocok", () => {
    expect(action()).toContain('organization.status !== "cancelled"');
    expect(action()).toContain("input.confirmName.trim() !== organization.name.trim()");
  });

  it("tidak menghapus akun auth owner", () => {
    expect(action()).not.toContain("auth.admin.deleteUser");
  });
});
