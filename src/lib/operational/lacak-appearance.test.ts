import { describe, expect, it } from "vitest";
import {
  DEFAULT_LACAK_APPEARANCE,
  LACAK_DENSITIES,
  LACAK_FONTS,
  LACAK_MODES,
  LACAK_PALETTES,
  lacakThemeProps,
  readLacakAppearance,
  resolveLacakScheme,
} from "./lacak-appearance";

describe("readLacakAppearance", () => {
  it("mengembalikan default saat tidak ada data sama sekali", () => {
    expect(readLacakAppearance(undefined)).toEqual(DEFAULT_LACAK_APPEARANCE);
  });

  it("mengembalikan default saat JSON kosong", () => {
    expect(readLacakAppearance({})).toEqual(DEFAULT_LACAK_APPEARANCE);
  });

  it("mengembalikan default untuk masukan yang bukan objek", () => {
    for (const value of [null, "palette=ngawur", 7, true, [1, 2, 3]]) {
      expect(readLacakAppearance(value)).toEqual(DEFAULT_LACAK_APPEARANCE);
    }
  });

  it("membaca keempat field saat semuanya valid", () => {
    expect(
      readLacakAppearance({ mode: "dark", palette: "indigo", density: "compact", font: "mono" }),
    ).toEqual({ mode: "dark", palette: "indigo", density: "compact", font: "mono" });
  });

  it("mengisi field yang tidak ada dari default tanpa mengganggu field lain", () => {
    expect(readLacakAppearance({ palette: "sage" })).toEqual({
      ...DEFAULT_LACAK_APPEARANCE,
      palette: "sage",
    });
  });

  it("membuang satu field ngawur tanpa ikut membuang field lain yang valid", () => {
    expect(
      readLacakAppearance({ mode: "ngawur", palette: "indigo", density: "nyaman", font: "mono" }),
    ).toEqual({ mode: DEFAULT_LACAK_APPEARANCE.mode, palette: "indigo", density: DEFAULT_LACAK_APPEARANCE.density, font: "mono" });
  });

  it("membuang nilai bertipe salah per field, bukan menolak seluruh objek", () => {
    expect(readLacakAppearance({ mode: 5, palette: ["indigo"], density: true, font: null })).toEqual(
      DEFAULT_LACAK_APPEARANCE,
    );
  });

  it("menolak upaya Prototype Pollution lewat kunci __proto__", () => {
    const polluted = JSON.parse('{"__proto__": {"mode": "dark"}, "mode": "dark"}');
    expect(readLacakAppearance(polluted).mode).toBe("dark");
    expect(({} as Record<string, unknown>).mode).toBeUndefined();
  });

  it("mengabaikan kunci asing di luar empat field yang dikenal", () => {
    expect(readLacakAppearance({ font: "inter", sinister: "x" })).toEqual({
      ...DEFAULT_LACAK_APPEARANCE,
      font: "inter",
    });
  });

  it("hanya menghasilkan nilai yang anggota dari daftar resminya", () => {
    for (const value of [DEFAULT_LACAK_APPEARANCE, readLacakAppearance({ mode: "dark" })]) {
      expect(LACAK_MODES).toContain(value.mode);
      expect(LACAK_PALETTES).toContain(value.palette);
      expect(LACAK_DENSITIES).toContain(value.density);
      expect(LACAK_FONTS).toContain(value.font);
    }
  });

  it("selalu mengembalikan objek baru, bukan rujukan default yang bisa dimutasi", () => {
    const first = readLacakAppearance({});
    first.mode = "dark";
    expect(readLacakAppearance({}).mode).toBe(DEFAULT_LACAK_APPEARANCE.mode);
    expect(DEFAULT_LACAK_APPEARANCE.mode).not.toBe("dark");
  });

  it("tetap membaca objek yang di-freeze", () => {
    expect(readLacakAppearance(Object.freeze({ mode: "light" }))).toMatchObject({ mode: "light" });
  });
});

describe("resolveLacakScheme", () => {
  it("memecahkan light dan dark apa adanya, mengabaikan preferensi sistem", () => {
    // Pilihan eksplisit menang atas preferensi OS, dua arah.
    expect(resolveLacakScheme("light", false)).toBe("lacak-light");
    expect(resolveLacakScheme("light", true)).toBe("lacak-light");
    expect(resolveLacakScheme("dark", false)).toBe("lacak-dark");
    expect(resolveLacakScheme("dark", true)).toBe("lacak-dark");
  });

  it("mengikuti prefersDark saat mode system", () => {
    expect(resolveLacakScheme("system", true)).toBe("lacak-dark");
    expect(resolveLacakScheme("system", false)).toBe("lacak-light");
  });

  it("menganggap prefersDark false saat tidak diketahui", () => {
    expect(resolveLacakScheme("system", undefined)).toBe("lacak-light");
  });

  it("mengembalikan class yang memang ada di globals.css", () => {
    const semua = [resolveLacakScheme("light", false), resolveLacakScheme("dark", false), resolveLacakScheme("system", true)];
    for (const kelas of semua) expect(["lacak-light", "lacak-dark"]).toContain(kelas);
  });
});

describe("lacakThemeProps", () => {
  it("menghasilkan atribut data untuk keempat pilihan", () => {
    const props = lacakThemeProps(
      readLacakAppearance({ mode: "dark", palette: "indigo", density: "compact", font: "inter" }),
      "lacak-dark",
    );
    expect(props).toEqual({
      scheme: "lacak-dark",
      "data-palette": "indigo",
      "data-density": "compact",
      "data-font": "inter",
    });
  });

  it("tidak pernah memuat style inline dari nilai theme", () => {
    const props = lacakThemeProps(readLacakAppearance({}), "lacak-light");
    expect(Object.keys(props)).not.toContain("style");
    expect(JSON.stringify(props)).not.toContain("oklch");
  });

  it("memakai nilai default ketika semua pilihan tidak dikenal", () => {
    const props = lacakThemeProps(
      readLacakAppearance({ palette: "<script>" as never, density: "1px" as never, font: "url(x)" as never }),
      "lacak-light",
    );
    expect(props["data-palette"]).toBe(DEFAULT_LACAK_APPEARANCE.palette);
    expect(props["data-density"]).toBe(DEFAULT_LACAK_APPEARANCE.density);
    expect(props["data-font"]).toBe(DEFAULT_LACAK_APPEARANCE.font);
  });
});
