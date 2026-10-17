import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = join(process.cwd(), "src", "components", "public");

/**
 * Baris yang benar-benar kode. Komentar dibuang karena penjelasan kenapa
 * DiceBear dibuang justru MEMBUTUH kata itu - tanpa membuang komentar, test
 * ini akan gagal karena komentarnya sendiri.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|\s)\/\/.*$/gm, "$1")
    .replace(/(^|\s)\*.*$/gm, "$1");
}

function publicComponents(): { name: string; code: string }[] {
  return readdirSync(DIR)
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => ({
      name: file,
      code: codeOnly(readFileSync(join(DIR, file), "utf8")),
    }));
}

describe("halaman publik tidak mengirim data tenant ke pihak ketiga", () => {
  const komponen = publicComponents();

  it("ada komponen untuk diperiksa", () => {
    expect(komponen.length).toBeGreaterThan(0);
  });

  it("tidak ada komponen publik yang memanggil api.dicebear.com", () => {
    const pemakai = komponen.filter((k) => /api\.dicebear\.com/.test(k.code)).map((k) => k.name);
    expect(pemakai).toEqual([]);
  });

  it("tidak memuat domain luar secara otomatis", () => {
    // Yang berbahaya adalah request tanpa klik: `img src` atau `Image src`
    // yang berisi URL LITERAL ke host asing. Nilai dinamis seperti
    // `src={logoUrl}` tidak di sini: nilainya sudah dibatasi `publicPhotoUrl`
    // ke `tenant-logos/{orgId}/...` di bucket milik tenant itu sendiri.
    const literal = /(?:<img[^>]*\bsrc=|<Image[^>]*\bsrc=)\s*\{?\s*["'`]https?:\/\/(?!localhost)/i;
    const pemakai = komponen.filter((k) => literal.test(k.code)).map((k) => k.name);
    expect(pemakai).toEqual([]);
  });

  it("tidak ada pemanggilan fetch di komponen publik", () => {
    const pemakai = komponen.filter((k) => /fetch\s*\(/i.test(k.code)).map((k) => k.name);
    expect(pemakai).toEqual([]);
  });

  it("tidak ada fetch baru Image yang menuju host asing", () => {
    const pemakai = komponen
      .filter((k) => /new\s+Image\s*\(\s*["'`]https?:\/\/(?!localhost)/i.test(k.code))
      .map((k) => k.name);
    expect(pemakai).toEqual([]);
  });
});

describe("kerangka halaman Lacak", () => {
  const shell = readFileSync(join(DIR, "lacak-shell.tsx"), "utf8");

  it("memakai layout kolom agar header dan footer bisa ditumpuk", () => {
    expect(shell).toContain("flex-col");
  });

  it("memakai tema lewat atribut data, bukan style inline", () => {
    expect(shell).toMatch(/data-palette=/);
    expect(shell).not.toMatch(/style=\{\{[^}]*--(lacak|font|primary)/);
  });

  it("merender banner, form, testimoni, dan footer", () => {
    expect(shell).toContain("PublicHeader");
    expect(shell).toContain("LacakForm");
    expect(shell).toContain("TestimonialsCarousel");
    expect(shell).toContain("PublicFooter");
  });

  it("tidak lagi memuat TenantBadge di body karena logo sudah di header", () => {
    expect(readFileSync(join(DIR, "lacak-form.tsx"), "utf8")).not.toContain("TenantBadge");
  });
});

describe("testimoni dan footer", () => {
  it("carousel tidak merender apa pun saat daftar kosong", () => {
    const carousel = readFileSync(join(DIR, "testimonials-carousel.tsx"), "utf8");
    expect(carousel).toMatch(/items\.length === 0\) return null/);
  });

  it("footer tidak merender apa pun saat tidak ada sosial maupun kontak", () => {
    const footer = readFileSync(join(DIR, "public-footer.tsx"), "utf8");
    expect(footer).toMatch(/adaSocial && !adaKontak\) return null/);
  });

  it("link sosial selalu membuka tab baru dengan rel aman", () => {
    const footer = codeOnly(readFileSync(join(DIR, "public-footer.tsx"), "utf8"));
    const targets = footer.match(/target="_blank"/g) ?? [];
    const rels = footer.match(/rel="noopener noreferrer"/g) ?? [];
    expect(targets).toHaveLength(rels.length);
    expect(targets.length).toBeGreaterThan(0);
  });
});

describe("header memakai token, bukan hex yang bisa melenceng dari css", () => {
  const header = codeOnly(readFileSync(join(DIR, "public-header.tsx"), "utf8"));

  it("fallback banner memakai --primary, bukan warna tetap", () => {
    expect(header).toContain("var(--primary)");
    expect(header).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("tombol WhatsApp dibangun dari nomor telepon, bukan URL yang sudah jadi", () => {
    expect(header).toContain("wa.me");
    expect(header).not.toMatch(/href=\{?"https:\/\//);
  });
});