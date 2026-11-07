import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/components/layout/command-palette.tsx"), "utf8");

/**
 * Palet dulu menampilkan formulir servis palsu yang tidak menyimpan apa pun,
 * dan "Keluar" hanya pindah ke `/login` tanpa menutup sesi. Keduanya terlihat
 * berfungsi sampai pengguna mencobanya. Test ini menjaga janji-janji itu.
 */
describe("command palette", () => {
  it("memakai dialog servis yang sebenarnya", () => {
    expect(source).toContain("NewServisDialog");
    // Formulir dummy punya id input ini; tidak boleh muncul lagi.
    expect(source).not.toContain("c-device");
  });

  it("logout menutup sesi, bukan hanya pindah halaman", () => {
    expect(source).toContain("auth.signOut()");
    expect(source).toContain('router.replace("/login")');
    expect(source).toContain("router.refresh()");
  });

  it("mencari servis nyata dan membuka halaman servis dengan query", () => {
    expect(source).toContain("getServisList");
    expect(source).toContain("/app/servis?q=");
  });

  it("menyediakan aksi cepat tambah servis, stok, dan karyawan", () => {
    expect(source).toContain("Tambah data servis");
    expect(source).toContain("Tambah stok produk");
    expect(source).toContain("Tambah data karyawan");
  });

  it("membuka dialog tujuan lewat URL, bukan sekadar pindah halaman", () => {
    expect(source).toContain("/app/inventori?edit=");
    expect(source).toContain("/app/inventori?new=1");
    expect(source).toContain("/app/customer?new=1");
    expect(source).toContain("/app/karyawan?new=1");
  });

  it("punya aksi cari servis eksplisit dan deep-link kas frontliner", () => {
    expect(source).toContain("Cari servis");
    expect(source).toContain("/app?action=catat-kas");
    expect(source).toContain("/app?action=tutup-kas");
  });

  it("filter dan kendali memakai parameter URL yang didukung halaman", () => {
    expect(source).toContain("/app/inventori?stok=menipis");
    expect(source).toContain("/app/servis?bayar=belum");
    expect(source).toContain("/app/garansi?status=Aktif");
    expect(source).toContain("setBranch");
    expect(source).toContain("setTheme");
  });

  it("tidak menjanjikan shortcut yang tidak terpasang", () => {
    // ⌘K memang terpasang di provider; ⌘N/⌘D tidak pernah ada.
    expect(source).not.toContain("⌘N");
    expect(source).not.toContain("⌘D");
  });
});
