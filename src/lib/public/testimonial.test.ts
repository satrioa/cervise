import { describe, expect, it } from "vitest";
import { readTestimonials, safeExternalUrl, type TestimonialRow } from "./testimonial";

function row(overrides: Partial<TestimonialRow> = {}): TestimonialRow {
  return {
    id: "t1",
    nama: "Budi",
    isi: "Servis cepat, 推荐 sangat Detail.",
    rating: 5,
    urutan: 0,
    is_active: true,
    created_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("readTestimonials", () => {
  it("mengembalikan baris yang valid apa adanya", () => {
    const hasil = readTestimonials([row()]);

    expect(hasil).toEqual([{ id: "t1", nama: "Budi", isi: "Servis cepat, 推荐 sangat Detail.", rating: 5 }]);
  });

  it("memotong spasi di nama dan isi", () => {
    const hasil = readTestimonials([row({ nama: "  Budi  ", isi: "  Mantap  " })]);

    expect(hasil[0]).toMatchObject({ nama: "Budi", isi: "Mantap" });
  });

  it("membuang testimoni yang tidak aktif, tanpa mengubah yang lain", () => {
    const hasil = readTestimonials([
      row({ id: "a", is_active: false }),
      row({ id: "b" }),
      row({ id: "c", is_active: false }),
    ]);

    expect(hasil.map((t) => t.id)).toEqual(["b"]);
  });

  it("membuang nama atau isi yang kosong setelah dipotong", () => {
    const hasil = readTestimonials([
      row({ id: "a", nama: "   " }),
      row({ id: "b", isi: "" }),
      row({ id: "c" }),
    ]);

    expect(hasil.map((t) => t.id)).toEqual(["c"]);
  });

  it("membolehkan rating null", () => {
    expect(readTestimonials([row({ rating: null })])[0].rating).toBeNull();
  });

  it("membuang rating di luar 1-5 dan menjadikannya null", () => {
    for (const rating of [0, 6, -1, 99]) {
      const hasil = readTestimonials([row({ rating })]);
      expect(hasil[0].rating, String(rating)).toBeNull();
    }
  });

  it("membuang rating pecahan dan rating bertipe salah", () => {
    for (const rating of [3.5, "5" as unknown as number, true as unknown as number]) {
      const hasil = readTestimonials([row({ rating })]);
      expect(hasil[0].rating, JSON.stringify(rating)).toBeNull();
    }
  });

  it("mengurutkan menurut urutan, lalu created_at ketika seri", () => {
    const hasil = readTestimonials([
      row({ id: "a", urutan: 2, created_at: "2026-09-01T00:00:00Z" }),
      row({ id: "b", urutan: 1, created_at: "2026-09-05T00:00:00Z" }),
      row({ id: "c", urutan: 1, created_at: "2026-09-02T00:00:00Z" }),
    ]);

    expect(hasil.map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("membatasi jumlah sesuai limit", () => {
    const banyak = Array.from({ length: 12 }, (_, i) => row({ id: `t${i}`, urutan: i }));

    expect(readTestimonials(banyak, 6)).toHaveLength(6);
  });

  it("memberi limit default yang wajar", () => {
    const banyak = Array.from({ length: 40 }, (_, i) => row({ id: `t${i}`, urutan: i }));

    expect(readTestimonials(banyak).length).toBeLessThanOrEqual(12);
  });

  it("mengembalikan array kosong untuk masukan kosong atau bukan array", () => {
    expect(readTestimonials([])).toEqual([]);
    expect(readTestimonials(null as unknown as TestimonialRow[])).toEqual([]);
    expect(readTestimonials(undefined as unknown as TestimonialRow[])).toEqual([]);
  });

  it("membuang baris yang bukan objek", () => {
    const hasil = readTestimonials([null as unknown as TestimonialRow, row({ id: "nyata" })], 5);

    expect(hasil.map((t) => t.id)).toEqual(["nyata"]);
  });
});

describe("safeExternalUrl", () => {
  it("menerima URL http dan https", () => {
    expect(safeExternalUrl("https://instagram.com/jcellular.id")).toBe("https://instagram.com/jcellular.id");
    expect(safeExternalUrl("http://example.com")).toBe("http://example.com");
  });

  it("memangkas spasi di sekeliling", () => {
    expect(safeExternalUrl("  https://example.com  ")).toBe("https://example.com");
  });

  it("menolak skema javascript, data, vbscript, dan file", () => {
    for (const jahat of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ]) {
      expect(safeExternalUrl(jahat), jahat).toBeNull();
    }
  });

  it("menolak URL relatif dan protocol-relative", () => {
    for (const relatif of ["/admin", "//evil.com", "instagram.com/x", "example.com"]) {
      expect(safeExternalUrl(relatif), relatif).toBeNull();
    }
  });

  it("menolak nilai kosong", () => {
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl("   ")).toBeNull();
  });

  it("menolak nilai bertipe selain string", () => {
    expect(safeExternalUrl(42 as unknown as string)).toBeNull();
    expect(safeExternalUrl({} as unknown as string)).toBeNull();
  });
});