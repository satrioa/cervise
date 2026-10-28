import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/components/layout/command-palette.tsx"), "utf8");

/**
 * Palet dulu menampilkan formulir servis palsu yang tidak menyimpan apa pun,
 * dan "Keluar" hanya pindah ke `/login` tanpa menutup sesi. Keduanya terlihat
 * berfungsi sampai pengguna mencobanya. Test ini menjaga dua janji itu.
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

  it("tidak menjanjikan shortcut yang tidak terpasang", () => {
    // ⌘K memang terpasang di provider; ⌘N/⌘D tidak pernah ada.
    expect(source).not.toContain("⌘N");
    expect(source).not.toContain("⌘D");
  });
});
