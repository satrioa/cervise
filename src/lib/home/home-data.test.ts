import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const homeData = read("src/lib/home/home-data.ts");
const homeAction = read("src/app/app/actions/home.ts");
const page = read("src/app/app/page.tsx");
const actor = read("src/lib/supabase/actor.ts");

/**
 * Home staf dulu merakit dirinya dari komponen klien: satu server action per
 * kartu, masing-masing me-resolve aktor dari awal. Test ini menjaga tiga
 * hal yang membuat paint pertama cepat:
 *
 * 1. aktor di-resolve sekali per request,
 * 2. angka dihitung database, bukan diunduh lalu disaring di JavaScript,
 * 3. halaman mengirim payload itu sebagai prop.
 */
describe("data Home dirender server", () => {
  it("aktor di-cache per request dan dipakai bersama layout/page", () => {
    // `layout.tsx` dan `page.tsx` sama-sama memanggilnya. Tanpa cache, satu
    // render membaca auth + employees + profiles + organizations + branches
    // + subscriptions dua kali.
    expect(actor).toContain("export const getActiveTenant = cache(");
    expect(actor).toContain("export const getActiveTenantForBilling = cache(");
  });

  it("getHomeData me-resolve aktor sekali untuk semua kartu", () => {
    expect((homeAction.match(/await getActiveTenant\(\)/g) ?? []).length).toBe(1);
    // Pemuatan per kelompok berjalan paralel, bukan berurutan.
    expect(homeAction).toContain("await Promise.all([");
    expect(homeAction).toContain("loadFrontlinerQueue(ctx)");
    expect(homeAction).toContain("loadFrontlinerKpi(ctx)");
    expect(homeAction).toContain("loadCashSession(ctx)");
  });

  it("halaman mengirim payload server, bukan membiarkan kartu meminta sendiri", () => {
    expect(page).toContain("getHomeData()");
    expect(page).toContain("initialData={home}");
  });

  it("KPI frontliner dihitung database, bukan dari ratusan baris", () => {
    expect(homeData).toContain('count: "exact", head: true');
    expect(homeData).toContain("buildFrontlinerKpiFromCounts");
    expect(homeData).not.toMatch(/select\("status, created_at"\)/);
  });

  it("antrean kasir hanya meminta penjualan untuk servis yang diambil", () => {
    // Versi lama mengambil SELURUH penjualan cabang hanya untuk membentuk
    // himpunan id yang sudah dibayar.
    expect(homeData).toContain('.in("servis_id", serviceIds)');
    expect(homeData).not.toMatch(/\.not\("servis_id", "is", null\)/);
  });

  it("dashboard teknisi tidak lagi mengunduh seluruh cabang", () => {
    expect(homeData).not.toMatch(/limit\(2000\)/);
    // Setiap query teknisi sudah dibatasi ke pemiliknya di database.
    expect(homeData).toMatch(/\.eq\("teknisi_id", userId\)/);
  });

  it("laporan shift memakai konteks yang sudah ada", () => {
    expect(homeData).toContain("export async function computeShiftReport(");
    expect(homeData).toContain("ctx: HomeContext");
  });
});
