import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const component = read("src/components/ui/laptop-mockup.tsx");
const hero = read("src/components/originkit/hero-02.tsx");

describe("LaptopMockupCard", () => {
  it("mengimpor cn dari @/lib/utils, bukan @/lib/cn", () => {
    // Jalur di repo ini `@/lib/utils`; `@/lib/cn` tidak ada dan akan gagal
    // di TypeScript.
    expect(component).toMatch(/from "@\/lib\/utils"/);
    expect(component).not.toMatch(/from "@\/lib\/cn"/);
  });

  it("tidak memasang clsx dan tailwind-merge secara terpisah", () => {
    // Paket `cn` sudah menggabungkan keduanya. Memasang dua paket itu
    // menambah dependensi tanpa menambah kemampuan.
    expect(component).not.toMatch(/from "clsx"/);
    expect(component).not.toMatch(/from "tailwind-merge"/);
  });

  it("ekspor daftar varian supaya bisa diuji", () => {
    expect(component).toMatch(/export const LAPTOP_FRAME_VARIANTS/);
  });

  it("pakai kelas gradient Tailwind v4 (bg-linear-to-b)", () => {
    // Proyek ini Tailwind v4.3.3; `bg-gradient-to-b` sudah tidak dipakai
    // sebagai penamaan utama di v4.
    expect(component).toMatch(/bg-linear-to-b/);
  });

  it("ukuran pakai prop size, bukan breakpoint md:", () => {
    // Komponen ini duduk di artboard yang diperkecil dengan transform: scale.
    // Kalau ukuran memakai `md:`, yang bereaksi adalah lebar viewport --
    // artboard 900px yang diskalakan ke layar 700px akan tetap memakai
    // ukuran besar dan tidak proporsional dengan HP di sebelahnya.
    expect(component).not.toMatch(/md:w-\[384px\]/);
    expect(component).not.toMatch(/md:h-63/);
    expect(component).toMatch(/size\?: LaptopMockupSize/);
  });

  it("ekspor tipe ukuran untuk pemanggil", () => {
    expect(component).toMatch(/export type LaptopMockupSize/);
  });

  it("isi layar berasal dari children, bukan gambar tetap", () => {
    // Kalau layar digambar sebagai SVG, isinya tidak bisa diganti dari luar
    // dan placeholder Cervise tidak bisa masuk.
    expect(component).toMatch(/\{children\}/);
  });
});

describe("pemasangan di hero", () => {
  it("LaptopMockupCard dipakai di PhoneShowcase", () => {
    expect(hero).toMatch(/LaptopMockupCard/);
  });

  it("HP tengah diganti, HP miring kiri dan kanan tetap", () => {
    // Tiga mockup: kiri miring -18.77deg, tengah, kanan miring 18.77deg.
    // Hanya tengah yang jadi laptop; kalau ketiganya ikut berubah, itu
    // tidak yang diminta.
    expect(hero).toMatch(/rotate-\[-18\.77deg\]/);
    expect(hero).toMatch(/rotate-\[18\.77deg\]/);
    const phoneCount = (hero.match(/<PhoneMockup/g) ?? []).length;
    expect(phoneCount).toBe(2);
  });

  it("tinggi artboard laptop dipakai, bukan tinggi HP", () => {
    // Artboard 342px dihitung dari HP tengah 735.556px yang dipotong. Laptop
    // jauh lebih pendek, jadi tinggi yang sama akan menyisakan ruang kosong
    // besar di bawah.
    expect(hero).toMatch(/LAPTOP_ARTBOARD|DESKTOP_ARTBOARD/);
  });
});
