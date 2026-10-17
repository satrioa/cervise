import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Gate langganan di `AppLayout` adalah penjaga utama aplikasi: tenant yang
 * trial-nya habis otomatis terkunci. Pengecualian untuk halaman tagihan
 * deshalb hanya boleh satu path - kalau melebar, data tenant yang sudah tidak
 * berhak ikut bisa dibaca.
 *
 * `isBillingExempt` tidak diekspor dari layout karena layout adalah server
 * component yang meng-import AppShell dan provider lain; mengujinya dengan
 * cara meng-import akan menarik seluruh pohon itu. Yang diuji di sini adalah
 * bentuk kodenya, sesuai pola yang dipakai `candy-button.test.ts` untuk hal
 * serupa. Perilaku penentu sudah teruji di `authorization.test.ts`.
 */
const layout = readFileSync(
  join(process.cwd(), "src/app/app/layout.tsx"),
  "utf8",
);

describe("AppLayout mengecualikan halaman tagihan dari gate langganan", () => {
  it("daftar pengecualian hanya memuat halaman subscription", () => {
    // Menambah path lain di sini berarti akun tanpa langganan aktif bisa
    // membukanya. Itu keputusan sadar, bukan penyesuaian kecil.
    expect(layout).toMatch(
      /const BILLING_EXEMPT_PREFIXES = \["\/app\/pengaturan\/subscription"\] as const/,
    );
    expect(layout).not.toMatch(/BILLING_EXEMPT_PREFIXES\s*=\s*\[.*\/app\/(?!pengaturan\/subscription)/);
  });

  it("tidak mengecualikan seluruh /app/pengaturan", () => {
    // Profil dan lokalisasi menyimpan data tenant. Mengaktifkannya untuk
    // akun yang langganannya berhenti berarti data itu bocor.
    expect(layout).not.toMatch(/"\/app\/pengaturan"/);
    expect(layout).not.toMatch(/"\/app\/pengaturan\/\*"/);
  });

  it("memakai actor penagihan hanya untuk path yang dikecualikan", () => {
    expect(layout).toMatch(/isBillingExempt\(pathname\) \? getActiveTenantForBilling\(\) : getActiveTenant\(\)/);
  });

  it("membaca pathname dari request header yang dikirim middleware", () => {
    // `AppLayout` adalah server component, jadi `usePathname()` tidak bisa
    // dipakai. Header `x-pathname` dipasang middleware.ts.
    expect(layout).toMatch(/await headers\(\)/);
    expect(layout).toMatch(/get\("x-pathname"\)/);

    const middleware = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
    expect(middleware).toMatch(/request\.headers\.set\("x-pathname", request\.nextUrl\.pathname\)/);
  });

  it("menyingkirkan prefiks locale sebelum membandingkan path", () => {
    // `next-intl` bisa menulis `/id/app/...`. Tanpa normalisasi, tenant
    // berbahasa Inggris akan tetap terkunci di halaman tagihan.
    expect(layout).toMatch(/replace\(\/\^\\\/\(\?:id\|en\)/);
    expect(layout).toMatch(/isBillingExempt\(pathname: string \| null\): boolean/);
  });

  it("menolak pathname kosong, bukan menganggapnya bebas", () => {
    // Tanpa header, path tidak diketahui. Default-nya harus MELEWATI gate,
    // bukan melewatinya - kalau terbalik, proteksi hilang tanpa jejak.
    expect(layout).toMatch(/if \(!pathname\) return false;/);
  });
});
