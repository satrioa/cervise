import { describe, expect, it } from "vitest";
import { parsePromoList, promoCountdown } from "./promo";

describe("parsePromoList", () => {
  it("memecah teks per baris dan membuang baris kosong", () => {
    expect(parsePromoList("A\n\n B \nC")).toEqual(["A", "B", "C"]);
  });

  it("menolak daftar kosong atau baris terlalu panjang", () => {
    expect(parsePromoList("  \n ")).toBeNull();
    expect(parsePromoList("x".repeat(161))).toBeNull();
  });
});

describe("promoCountdown", () => {
  const now = new Date("2026-11-20T10:00:00.000Z");

  it("menghitung hari, jam, menit, dan detik", () => {
    expect(promoCountdown("2026-11-22T12:05:10.000Z", now)).toEqual({
      ended: false,
      days: 2,
      hours: 2,
      minutes: 5,
      seconds: 10,
    });
  });

  it("menandai promo yang sudah berakhir", () => {
    expect(promoCountdown("2026-11-19T00:00:00.000Z", now).ended).toBe(true);
  });
});
