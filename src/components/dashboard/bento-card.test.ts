import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bentoCardVariants, bentoGridVariants } from "./bento-card";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const technician = read("src/components/dashboard/technician-dashboard.tsx");
const frontliner = read("src/components/dashboard/frontliner-dashboard.tsx");

describe("bentoCardVariants", () => {
  it("kartu masuk dengan naik + fade, bukan scale", () => {
    // Scale 0.96 → 1 pada kartu sebesar ini bikin teks di dalamnya ikut
    // ber-focus, dan grid yang rapat jadi terlihat bergeser.
    const hidden = bentoCardVariants.hidden as { y: number; opacity: number };
    expect(hidden.opacity).toBe(0);
    expect(hidden.y).toBe(12);
    expect(hidden).not.toHaveProperty("scale");
  });

  it("naiknya 12px, bukan 20px", () => {
    // 20px terlihat menabrak tetangganya di grid rapat.
    expect((bentoCardVariants.hidden as { y: number }).y).toBe(12);
  });

  it("berhenti tepat di y=0, bukan sisa pecahan", () => {
    // Kalau `show` tidak_override y, kartu berhenti 12px di bawah selnya --
    // jadi dizerender 1px di bawah grid.
    expect((bentoCardVariants.show as { y: number }).y).toBe(0);
  });

  it("pakai easing yang sama dengan hero dan stepper", () => {
    const t = (bentoCardVariants.show as { transition: { ease: readonly number[] } }).transition;
    expect(t.ease).toEqual([0.215, 0.61, 0.355, 1]);
  });
});

describe("bentoGridVariants", () => {
  it("stagger datang dari grid, bukan dari indeks per kartu", () => {
    // Kalau tiap kartu menghitung delay dari nomor urut, setiap pemanggilan
    // site harus ingat mengoper indeks, dan satu yang terlupa akan muncul
    // tanpa animasi.
    const grid = bentoGridVariants(0.05);
    const t = (grid.show as { transition: { staggerChildren: number } }).transition;
    expect(t.staggerChildren).toBe(0.05);
  });

  it("delayChildren kecil supaya kartu pertama tidak menggantung", () => {
    const grid = bentoGridVariants(0.05);
    const t = (grid.show as { transition: { delayChildren: number } }).transition;
    expect(t.delayChildren).toBeLessThan(0.1);
  });
});

describe("kedua dashboard memakai grid berstagger", () => {
  it("grid dibungkus motion.div, bukan div biasa", () => {
    for (const [name, source] of [
      ["teknisi", technician],
      ["frontliner", frontliner],
    ] as const) {
      expect(source, name).toMatch(/motion\.div/);
    }
  });

  it("tidak ada indeks yang dioper ke BentoCard", () => {
    // Kalimat di rencana awal menyebut kartu "meneruskan index"; approaches
    // variants membuat itu tidak perlu, dan prop seperti itu tidak pernah ada
    // di BentoCardProps.
    for (const [name, source] of [
      ["teknisi", technician],
      ["frontliner", frontliner],
    ] as const) {
      expect(source, name).not.toMatch(/<BentoCard[^>]*\bindex=/);
    }
  });

  it("stagger lebih kecil di frontliner yang kartunya lebih banyak", () => {
    // 8 kartu x 0.05 = 400ms, terasa nanggung di grid yang penuh.
    expect(frontliner).toMatch(/const BENTO_STAGGER = 0\.0[0-4]/);
    expect(technician).toMatch(/const BENTO_STAGGER = 0\.0[45]/);
  });
});

describe("kartu HARUS membiarkan pewarisan variants", () => {
  /**
   * Bug yang sudah terjadi sekali.
   *
   * `isControllingVariants()` (motion-dom) menyatakan sebuah node
   * "mengendalikan variants sendiri" begitu `initial` atau `animate` berisi
   * variant label. Node seperti itu TIDAK mewarisi context induknya, dan
   * `staggerChildren` hanya bekerja lewat pewarisan itu. Hasilnya: semua kartu
   * beranimasi bersamaan dan tidak ada stagger sama sekali, padahal kodenya
   * terlihat benar.
   *
   * Karena itu test ini memeriksa bentuk kode, bukan hasilnya -- hasil
   * animasi tidak bisa diamati tanpa browser.
   */
  const bento = read("src/components/dashboard/bento-card.tsx");

  it("kartu tidak memasang initial atau animate sendiri", () => {
    // Diperiksa hanya di badan BentoCard. Memeriksa seluruh file akan
    // salah tangkap: props GRID memang wajib punya initial/animate -- justru
    // dia yang mengendalikan stagger.
    const start = bento.indexOf("export function BentoCard(");
    expect(start).toBeGreaterThan(-1);
    const body = bento.slice(start, bento.indexOf("\nexport function", start + 10));

    expect(body).not.toMatch(/initial:/);
    expect(body).not.toMatch(/animate:/);
    // Kartu menarik props dari `cardProps`, yang isinya hanya `variants`.
    expect(body).toMatch(/const animation = cardProps/);
  });

  it("variants kartu memang ada -- tanpa itu tidak ada yang bisa diwarisi", () => {
    // Kartu harus punya `variants`, tapi TANPA initial/animate.
    expect(bento).toMatch(/const cardProps = reduceMotion \? \{\} : \{ variants: bentoCardVariants \}/);
  });

  it("grid yang memasang initial dan animate, bukan kartu", () => {
    expect(bento).toMatch(/const gridProps = reduceMotion[\s\S]{0,160}initial: "hidden" as const[\s\S]{0,80}animate: "show" as const/);
  });

  it("kedua dashboard memakai gridProps, bukan variants langsung", () => {
    for (const [name, source] of [
      ["teknisi", technician],
      ["frontliner", frontliner],
    ] as const) {
      expect(source, name).toMatch(/useBentoStagger\(BENTO_STAGGER\)/);
      expect(source, name).toMatch(/<motion\.div \{\.\.\.gridProps\}/);
      // Kalau grid memasang variants langsung, reduce-motion tidak lagi
      // terkontrol di satu tempat.
      expect(source, name).not.toMatch(/bentoGridVariants\(BENTO_STAGGER\)\}/);
    }
  });
});

describe("prefers-reduced-motion", () => {
  it("bento-card memakai useReducedMotion, bukan mengabaikan", () => {
    const bento = read("src/components/dashboard/bento-card.tsx");
    expect(bento).toMatch(/useReducedMotion/);
  });

  it("kartu dan grid dikosongkan, bukan hanya initial={false}", () => {
    // Kalau kartu tetap memakai `variants` dengan `initial="hidden"` saat
    // reduce-motion aktif, kartu terkunci di `opacity: 0` dan tidak pernah
    // muncul. Kosongkan props-nya sepenuhnya.
    const bento = read("src/components/dashboard/bento-card.tsx");
    expect(bento).toMatch(/const cardProps = reduceMotion \? \{\} :/);
    expect(bento).toMatch(/const gridProps = reduceMotion\n?\s*\? \{\}/);
  });

  it("null diperlakukan sebagai boleh beranimasi", () => {
    // Hasil hook `boolean | null` sebelum hydrate. `!null` bernilai true,
    // yang berarti semua kartu terkunci diam di render pertama.
    const bento = read("src/components/dashboard/bento-card.tsx");
    expect(bento).toMatch(/useReducedMotion\(\) === true/);
  });
});
