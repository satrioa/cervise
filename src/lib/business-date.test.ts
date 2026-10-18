import { describe, expect, it } from "vitest";
import { BUSINESS_TIME_ZONE, businessDate, businessDayStartIso } from "./business-date";

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

describe("businessDayStartIso", () => {
  it("menjadi tengah malam WIB, bukan tengah malam UTC", () => {
    // 00:00 WIB = 17:00 UTC sehari sebelumnya.
    expect(businessDayStartIso(new Date("2026-10-18T02:00:00Z"))).toBe("2026-10-17T17:00:00.000Z");
  });

  it("memakai tanggal toko, jadi servis jam 1 pagi masuk hari yang sama", () => {
    // 2026-10-18 01:00 WIB masih 2026-10-17 UTC, tapi hari tokonya 18.
    expect(businessDayStartIso(new Date("2026-10-17T18:00:00Z"))).toBe("2026-10-17T17:00:00.000Z");
  });
});