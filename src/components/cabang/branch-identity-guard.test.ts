import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Cabang tidak boleh punya avatar atau letter tile di mana pun.
 *
 * Tidak ada foto profil cabang (form tambah cabang memang tidak punya
 * upload), dan tidak ada alasan untuk membuat slot avatar bolong -- kotak
 * bundar kosong yang tidak akan pernah terisi. Semuanya dihapus; cabang
 * diidentifikasi lewat namanya saja.
 *
 * Assertion di bawah dipatok ke berkas tertentu. Kalau hanya dicek "tidak ada
 * Avatar di file mana pun", assertion-nya bisa satisfied oleh pemakaian yang
 * tidak terkait: `Avatar` masih sah untuk ANGGOTA cabang, karena itu orang
 * sungguhan dan punya foto.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

const readCode = (p: string) => stripComments(read(p));

const appShell = readCode("src/components/layout/app-shell.tsx");
const branchDrawer = readCode("src/components/cabang/cabang-drawer.tsx");
const branchCards = readCode("src/components/cabang/branch-cards.tsx");

describe("cabang tidak punya avatar di mana pun", () => {
  it("komponen letter tile untuk cabang sudah dihapus", () => {
    // Kalau file ini masih ada, berarti ada pemanggil yang belum dibersihkan.
    expect(() => read(join(process.cwd(), "src/components/cabang/branch-mark.tsx"))).toThrow();
    for (const source of [appShell, branchDrawer]) {
      expect(source).not.toMatch(/BranchMark/);
      expect(source).not.toMatch(/branch-mark/);
    }
  });

  it("tidak ada letter tile yang dihitung inline dari nama cabang", () => {
    // Drawer sempat punya `branch.name.trim()[0]` sendiri di header, terpisah
    // dari komponen bersama. Dua implementasi, dan mudahnya hanya satu yang
    // dibersihkan.
    expect(branchDrawer).not.toMatch(/branch\.name\.trim\(\)\[0\]/);
    expect(appShell).not.toMatch(/branch\.label\.trim\(\)\[0\]/);
    expect(appShell).not.toMatch(/function branchTone/);
    expect(appShell).not.toMatch(/function branchLetter/);
  });

  it("branch switcher hanya menampilkan nama", () => {
    expect(appShell).toMatch(/truncate font-semibold text-sm text-left/);
    // Nama cabang tetap ada; yang hilang hanya mark-nya.
    expect(appShell.match(/branch\.label/g)?.length ?? 0).toBeGreaterThan(0);
  });

  it("drawer tidak punya mark, tapi badge status tetap ada", () => {
    // Status aktif/nonaktif pindah responsibility ke badge di sebelah nama.
    // Kalau mark dihapus tapi badge ikut hilang, informasinya hilang.
    expect(branchDrawer).toMatch(/branch\.is_active \? "Aktif" : "Nonaktif"/);
  });

  it("Avatar yang tersisa di drawer hanya untuk anggota, bukan cabang", () => {
    // Anggota adalah orang, jadi avatar bundar di situ benar. Yang dilarang
    // adalah avatar untuk cabang.
    expect(branchDrawer.match(/<Avatar\b/g)?.length ?? 0).toBe(1);
    expect(branchDrawer).toMatch(/m\.initials/);
  });

  it("kartu cabang juga tidak merender avatar", () => {
    expect(branchCards).not.toMatch(/Avatar/);
    expect(branchCards).not.toMatch(/<img\b/);
    expect(branchCards).not.toMatch(/next\/image/);
  });
});
