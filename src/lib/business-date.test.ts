import { describe, expect, it } from "vitest";
import { BUSINESS_TIME_ZONE, businessDate } from "./business-date";

describe("businessDate", () => {
  it("menggunakan tanggal kalender Asia/Jakarta, bukan UTC", () => {
    // 2026-10-17T20:00:00Z = 2026-10-18 03:00 WIB
    expect(businessDate(new Date("2026-10-17T20:00:00Z"))).toBe("2026-10-18");
  });

  it("tidak bergeser untuk toko yang buka setelah tengah malam", () => {
    expect(businessDate(new Date("2026-10-17T17:00:00Z"))).toBe("2026-10-18");
    expect(businessDate(new Date("2026-10-17T16:59:59Z"))).toBe("2026-10-17");
  });

  it("menyimpan zona sebagai konstanta supaya migration bisa membacanya", () => {
    expect(BUSINESS_TIME_ZONE).toBe("Asia/Jakarta");
  });
});