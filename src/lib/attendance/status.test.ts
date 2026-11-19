import { describe, expect, it } from "vitest";
import { attendanceStatus, wibDate, wibMinutes } from "./status";

describe("wibDate", () => {
  it("memakai tanggal WIB, bukan UTC", () => {
    expect(wibDate("2026-11-19T16:30:00.000Z")).toBe("2026-11-19"); // 23:30 WIB
    expect(wibDate("2026-11-19T17:30:00.000Z")).toBe("2026-11-20"); // 00:30 WIB
  });
});

describe("wibMinutes", () => {
  it("mengubah jam WIB ke menit", () => {
    expect(wibMinutes("2026-11-19T01:00:00.000Z")).toBe(8 * 60);
    expect(wibMinutes("2026-11-19T10:30:00.000Z")).toBe(17 * 60 + 30);
  });
});

describe("attendanceStatus", () => {
  const jam = { checkInTime: "08:00", checkOutTime: "17:00" };

  it("Hadir untuk masuk dan pulang tepat waktu", () => {
    expect(attendanceStatus({ checkInAt: "2026-11-19T01:00:00.000Z", checkOutAt: "2026-11-19T10:00:00.000Z", ...jam })).toBe("HADIR");
  });
  it("Terlambat kalau masuk setelah jam cabang", () => {
    expect(attendanceStatus({ checkInAt: "2026-11-19T01:01:00.000Z", checkOutAt: "2026-11-19T10:00:00.000Z", ...jam })).toBe("TERLAMBAT");
  });
  it("Pulang awal kalau pulang sebelum jam cabang", () => {
    expect(attendanceStatus({ checkInAt: "2026-11-19T01:00:00.000Z", checkOutAt: "2026-11-19T09:30:00.000Z", ...jam })).toBe("PULANG_AWAL");
  });
  it("Belum pulang kalau check_out kosong", () => {
    expect(attendanceStatus({ checkInAt: "2026-11-19T01:00:00.000Z", checkOutAt: null, ...jam })).toBe("BELUM_PULANG");
  });
  it("Belum masuk kalau tidak ada check_in (baris defensif)", () => {
    expect(attendanceStatus({ checkInAt: null, checkOutAt: null, ...jam })).toBe("BELUM_MASUK");
  });
});
