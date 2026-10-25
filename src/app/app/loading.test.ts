import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `loading.tsx` route adalah skeleton PERTAMA yang dilihat pengguna saat
 * berpindah halaman. Kalau bentuknya generik (satu blok), halaman melompat
 * dua kali: pertama dari skeleton generik ke skeleton route, lalu ke data.
 *
 * Test ini memastikan setiap route berat punya `loading.tsx` sendiri yang
 * memakai komponen bentuk dari `@/components/ui/route-skeleton`, bukan
 * menulis rectangle sendiri.
 */

const APP_DIR = join(process.cwd(), "src", "app", "app");

/** Route yang isi utamanya tabel/kartu dan paling sering dibuka. */
const ROUTES_WITH_LOADING = [
  "analitik-servis",
  "audit-log",
  "customer",
  "garansi",
  "keuangan/transaksi",
  "laporan/keuangan",
  "laporan/penjualan",
  "laporan/performa",
  "laporan/servis",
  "laporan/shift",
  "pengaturan/usage",
  "penjualan",
  "servis",
];

describe("loading.tsx per route berat", () => {
  it("setiap route berat punya file loading.tsx", () => {
    for (const route of ROUTES_WITH_LOADING) {
      const file = join(APP_DIR, route, "loading.tsx");
      expect(
        statSync(file, { throwIfNoEntry: false })?.isFile(),
        `${route} belum punya loading.tsx`,
      ).toBe(true);
    }
  });

  it("loading.tsx memakai primitive bentuk, bukan rectangle sendiri", () => {
    for (const route of ROUTES_WITH_LOADING) {
      const file = join(APP_DIR, route, "loading.tsx");
      const source = readFileSync(file, "utf8");
      expect(
        source,
        `${route}/loading.tsx harus memakai primitive bentuk yang dipakai bersama`,
      ).toMatch(/@\/components\/ui\/(route-skeleton|skeleton-shapes)/);
    }
  });

  it("loading.tsx menggambar banyak elemen, bukan satu blok", () => {
    for (const route of ROUTES_WITH_LOADING) {
      const file = join(APP_DIR, route, "loading.tsx");
      const source = readFileSync(file, "utf8");
      const calls =
        (source.match(/<Skeleton\b/g) ?? []).length +
        (source.match(/TableRowsSkeleton/g) ?? []).length +
        (source.match(/StatCardsSkeleton/g) ?? []).length +
        (source.match(/DataTableCardSkeleton/g) ?? []).length +
        (source.match(/RouteHeaderSkeleton/g) ?? []).length +
        (source.match(/RouteFiltersSkeleton/g) ?? []).length +
        (source.match(/ChartSkeleton/g) ?? []).length;
      expect(
        calls,
        `${route}/loading.tsx hanya menggambar satu blok`,
      ).toBeGreaterThan(3);
    }
  });

  it("tidak ada loading.tsx yang memakai `rows=` untuk blok besar", () => {
    for (const route of ROUTES_WITH_LOADING) {
      const file = join(APP_DIR, route, "loading.tsx");
      const source = readFileSync(file, "utf8");
      const big = source.match(/rows=\{(\d+)\}/g) ?? [];
      for (const call of big) {
        const value = Number(call.match(/\d+/)?.[0] ?? "0");
        expect(
          value,
          `${route}/loading.tsx masih memakai rows={${value}}`,
        ).toBeLessThanOrEqual(8);
      }
    }
  });

  it("loading.tsx global fallback juga memakai bentuk, bukan blok polos", () => {
    const source = readFileSync(join(APP_DIR, "loading.tsx"), "utf8");
    expect(source).toContain("ChartSkeleton");
    expect(source).not.toMatch(/AsciiSkeleton/);
  });
});

describe("route-skeletontx", () => {
  it("menyediakan kepala, kartu statistik, dan kartu tabel", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "components", "ui", "route-skeleton.tsx"),
      "utf8",
    );
    expect(source).toContain("export function RouteHeaderSkeleton");
    expect(source).toContain("export function StatCardsSkeleton");
    expect(source).toContain("export function DataTableCardSkeleton");
  });

  it("ada route yang punya loading.tsx sendiri", () => {
    // Kalau route punya `loading.tsx`, ia harus mandiri menggambar
    // bentuknya - tidak boleh bergantung pada fallback global yang generik.
    const withLoading = readdirSync(APP_DIR).filter((entry) => {
      const full = join(APP_DIR, entry);
      try {
        return statSync(full).isDirectory() && statSync(join(full, "loading.tsx")).isFile();
      } catch {
        return false;
      }
    });
    expect(withLoading.length).toBeGreaterThan(0);
  });
});
