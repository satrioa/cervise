import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const dialog = read("src/components/cash/closing-dialog.tsx");
const frontliner = read("src/components/dashboard/frontliner-dashboard.tsx");
const cash = read("src/app/app/actions/cash.ts");
const homeData = read("src/lib/home/home-data.ts");

/**
 * Preview Tutup Toko dulu menunggu seluruh round-trip server sebelum
 * menampilkan satu angka pun. Dashboard sudah memuat laporan yang sama saat
 * mount, jadi dialog memakainya sebagai angka awal dan menyegarkan di latar
 * belakang.
 */
describe("preview tutup toko", () => {
  it("memakai laporan yang sudah dimuat dashboard sebagai angka awal", () => {
    expect(dialog).toContain("initialReport");
    expect(dialog).toContain("setReport(initialReport ?? null)");
    // Skeleton hanya muncul kalau memang belum ada angka sama sekali.
    expect(dialog).toContain("setLoading(!initialReport)");
    expect(frontliner).toContain("initialReport={report}");
  });

  it("menyegarkan di latar belakang tanpa mengosongkan preview", () => {
    expect(dialog).toContain("setRefreshing");
    expect(dialog).toContain("Memperbarui…");
    // Error saat refresh tidak boleh menghapus angka yang sudah tampil.
    expect(dialog).toMatch(/if \(!result\.ok\) \{[\s\S]*setLoading\(false\)/);
  });

  it("hanya me-resolve aktor sekali per preview", () => {
    // `getActiveTenant()` membaca auth + employees + profiles + organizations
    // + branches + subscriptions. Versi lama memanggilnya tiga kali
    // (getShiftPreview -> computeReport -> hydrateSessions), jadi dialog
    // menunggu belasan round-trip sebelum query laporan jalan.
    const start = cash.indexOf("export async function getShiftPreview");
    const end = cash.indexOf("export async function getShiftReport");
    const body = cash.slice(start, end);
    expect((body.match(/await cashContext\(\)/g) ?? []).length).toBe(1);
    expect(body).toContain("computeShiftReport(ctx,");

    // Perhitungan laporan menerima konteks yang sudah ada, bukan me-resolve
    // ulang aktornya sendiri. Fungsi itu tinggal di modul data bersama supaya
    // Home bisa memakai loader yang sama.
    const computeStart = homeData.indexOf("export async function computeShiftReport(");
    const computeEnd = homeData.indexOf("// To-Do pribadi");
    expect(computeStart).toBeGreaterThan(-1);
    const computeBody = homeData.slice(computeStart, computeEnd);
    expect(computeBody).toContain("ctx: HomeContext");
    expect(computeBody).not.toContain("getActiveTenant");
  });
});
