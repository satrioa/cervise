import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const dialog = read("src/components/servis/new-servis-dialog.tsx");
const frontliner = read("src/components/dashboard/frontliner-dashboard.tsx");
const technician = read("src/components/dashboard/technician-dashboard.tsx");

/**
 * "Servis baru" di dashboard dulu menautkan ke `/app/servis/baru`. Satu
 * navigasi penuh hanya untuk formulir yang tidak butuh halaman sendiri, dan
 * kasir kehilangan dashboard-nya. Sekarang kartunya membuka dialog.
 *
 * Route `/app/servis/baru` TIDAK dihapus: bottom-nav `AppShell` masih memakai
 * route itu sebagai tombol "Tambah".
 */
describe("servis baru dari dashboard", () => {
  it("dialog memakai ServisForm yang sama dengan halaman /app/servis/baru", () => {
    // Satu form untuk dua pintu masuk. Kalau dialog punya salinan sendiri,
    // setiap field baru harus ditambahkan dua kali.
    expect(dialog).toContain('from "@/components/servis/servis-form"');
    expect(dialog).toContain("<ServisForm");
    expect(dialog).toContain("onSuccess={handleSuccess}");
    expect(dialog).toContain("onCancel={() => onOpenChange(false)}");
  });

  it("setelah tersimpan dialog menutup dan dashboard memuat ulang datanya", () => {
    expect(dialog).toContain("onOpenChange(false)");
    // Dashboard mengambil antrean lewat server action dari komponen klien.
    // `router.refresh()` tidak me-mount ulang komponen, jadi daftar servis
    // tetap lama kalau pemanggil tidak menyegarkan datanya sendiri.
    expect(dialog).toContain("onCreated?.()");
    expect(frontliner).toContain("onCreated={() => void reload()}");
    expect(technician).toContain("onCreated={() => void reload()}");
  });

  it("kartu bento membuka dialog, bukan pindah halaman", () => {
    for (const source of [frontliner, technician]) {
      expect(source).toContain('from "@/components/servis/new-servis-dialog"');
      expect(source).toContain('onClick={() => setNewServisOpen(true)}');
      expect(source).toContain("<NewServisDialog");
      // Tautan lama tidak boleh tersisa di dashboard mana pun.
      expect(source).not.toContain('href="/app/servis/baru"');
    }
  });

  it("route /app/servis/baru tetap dipakai bottom-nav AppShell", () => {
    const shell = read("src/components/layout/app-shell.tsx");
    expect(shell).toContain('href: "/app/servis/baru"');
  });
});
