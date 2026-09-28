import { describe, expect, it } from "vitest";
import { normalizePhone62, toFonnteTarget, validatePhone } from "./phone";

describe("normalizePhone62", () => {
  it("menggabungkan awalan 0, 8, 62, dan +62 ke satu bentuk", () => {
    expect(normalizePhone62("081234567890")).toBe("6281234567890");
    expect(normalizePhone62("81234567890")).toBe("6281234567890");
    expect(normalizePhone62("6281234567890")).toBe("6281234567890");
    expect(normalizePhone62("+62 812-3456-7890")).toBe("6281234567890");
  });

  it("menolak nomor yang tidak masuk akal", () => {
    expect(normalizePhone62("0812")).toBeNull();
    expect(normalizePhone62("")).toBeNull();
    expect(normalizePhone62(null)).toBeNull();
    expect(normalizePhone62(undefined)).toBeNull();
    expect(normalizePhone62("+1 202 555 0147")).toBeNull();
  });
});

describe("validatePhone", () => {
  it("menganggap kosong sebagai tidak diisi, bukan error", () => {
    expect(validatePhone("")).toEqual({ ok: true, value: null });
    expect(validatePhone("   ")).toEqual({ ok: true, value: null });
    expect(validatePhone(null)).toEqual({ ok: true, value: null });
  });

  it("mengembalikan bentuk kanonik untuk nomor yang valid", () => {
    expect(validatePhone(" 0812 3456 7890 ")).toEqual({
      ok: true,
      value: "6281234567890",
    });
  });

  it("menolak karakter yang bukan bagian dari nomor", () => {
    const result = validatePhone("<script>x</script>");
    expect(result.ok).toBe(false);
  });

  it("menolak nomor yang terlalu panjang", () => {
    expect(validatePhone("+62 812 3456 7890 1234 5678").ok).toBe(false);
  });
});

describe("toFonnteTarget", () => {
  it("hanya menerima hasil yang diawali 62", () => {
    expect(toFonnteTarget("081234567890")).toBe("6281234567890");
    expect(toFonnteTarget("12025550147")).toBeNull();
    expect(toFonnteTarget(null)).toBeNull();
  });
});
