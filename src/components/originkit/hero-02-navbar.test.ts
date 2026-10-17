import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Dua hal di navbar landing page yang sama-sama bisa rusak tanpa error:
 *
 * 1. Foto profil. `page.tsx` menyusun `heroUser` lalu meneruskannya ke navbar.
 *    Kalau `avatar_url` tidak ikut diselect, `heroUser.avatarUrl` tetap
 *    `undefined` dan navbar diam-diam jatuh ke nilai cadangan. Tidak ada error,
 *    tidak ada build gagal -- hanya foto profil asli yang tidak pernah muncul,
 *    padahal kolomnya sudah terisi di database. Itu persis gejala yang terjadi
 *    sebelum perbaikan ini, jadi select-nya yang dijaga, bukan cuma turunannya.
 *
 * 2. Fallback DiceBear. Repo ini sudah menyingkirkannya di `lib/photos.ts`
 *    dengan alasan yang eksplisit: ia mengirim nama pengguna ke pihak ketiga
 *    setiap kali komponen dirender. Navbar landing page adalah yang paling sering
 *    dirender, jadi ia yang paling perlu dijaga. Komentar yang menyebut
 *    "dicebear" tidak dihitung sebagai pemakaian.
 */
const pageSource = readFileSync(join(process.cwd(), "src", "app", "page.tsx"), "utf8");
const heroSource = readFileSync(
  join(process.cwd(), "src", "components", "originkit", "hero-02.tsx"),
  "utf8");

/**
 * Baris yang benar-benar kode: komentar `//`, blok `*`, dan komentar JSX
 * dibuang.
 *
 * Buang komentar itu penting, bukan hiasan. Penjelasan kenapa badge
 * "Multibranch" dihapus justru MEMBUTUH kata itu, jadi tanpa membuang komentar
 * test ini akan gagal karena komentarnya sendiri -- persis kebalikan dari yang
 * mau dijaga. Assertion di bawah harus melihat Badge-nya, bukan catatan
 * penjelasannya.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|\s)\/\/.*$/gm, "$1")
    .replace(/(^|\s)\*.*$/gm, "$1");
}

describe("navbar landing page: foto profil", () => {
  it("page.tsx menyelect avatar_url, tanpa itu foto asli tidak pernah dikirim", () => {
    const select = pageSource.match(/select\(([^)]*avatar_url[^)]*)\)/);
    expect(select).not.toBeNull();
  });

  it("avatarUrl disusun lewat publicPhotoUrl supaya path berbahaya ditolak", () => {
    // Dipakai langsung tanpa validasi, kolom database bisa berisi "../" atau
    // URL luar yang membuat getPublicUrl menunjuk ke host lain.
    expect(pageSource).toContain("publicPhotoUrl(");
  });

  it("heroUser benar-benar diberi avatarUrl, bukan hanya dideklarasikan di tipe", () => {
    // Tipe `heroUser` sudah lama punya `avatarUrl` sejak awal, padahal tidak
    // pernah diisi. Deklarasi di tipe bukan bukti bahwa fieldnya terisi.
    expect(pageSource).toMatch(/heroUser\s*=\s*\{[^}]*avatarUrl/);
  });

  it("navbar tidak memanggil api.dicebear.com lagi", () => {
    expect(codeOnly(heroSource)).not.toMatch(/api\.dicebear\.com/);
  });

  it("nilai cadangan memakai initialsOf dari lib/photos, bukan hitungan sendiri", () => {
    // `initialsOf` calculating lokal supaya tidak ada nama yang terkirim ke
    // pihak ketiga, dan hasilnya sama dengan sidebar compact.
    expect(heroSource).toContain('from "@/lib/photos"');
    expect(heroSource).toContain("initialsOf(");
  });

  it("AvatarFallback tetap dipakai supaya kondisi tanpa foto tidak kosong", () => {
    expect(heroSource).toContain("<AvatarFallback");
  });
});

describe("navbar landing page: badge Multibranch", () => {
  it("badge Multibranch tidak ada lagi di dalam navbar", () => {
    // Dipotong ke isi <nav>...</nav> supaya badge "Multibranch · PWA" di hero
    // tidak ikut tertangkap -- itu konteks lain dan sengaja dibiarkan.
    // `codeOnly` supaya penjelasan di dalam JSX tidak ikut terhitung.
    const nav = codeOnly(heroSource).match(/<nav\b[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(nav).not.toBe("");
    expect(nav).not.toMatch(/Multibranch/);
  });

  it("badge Multibranch di hero tetap ada, itu bukan navbar", () => {
    // Pemisah di teks badge itu BULLET (U+2022), bukan middle dot (U+00B7) --
    // keduanya tampil mirip di terminal, jadi kelas karakternya dibuat longgar
    // supaya test ini tidak rapuh hanya karena perbedaan glyph.
    expect(codeOnly(heroSource)).toMatch(/Multibranch\s*[^\w\s]?\s*PWA/);
  });

  it("logo dan nama Cervise di navbar tidak ikut terhapus", () => {
    // Penjelasan soal kenapa badge dihapus ada di dalam <Link>, jadi mudah
    // dibaca sebagai "kok ada komentar aneh di sini" kalau suatu saat dihapus
    // lagi tanpa alasan.
    const nav = heroSource.match(/<nav\b[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(nav).toContain("Cervise");
  });
});
