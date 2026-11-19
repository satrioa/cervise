import { describe, expect, it } from "vitest";
import { workDuration, type LogRow } from "./kiosk-data";

function row(jamMasuk: string | null, jamPulang: string | null): LogRow {
  return {
    tanggal: "2026-11-19",
    jamMasuk,
    jamPulang,
    checkInTime: "08:00",
    checkOutTime: "17:00",
  };
}

describe("workDuration", () => {
  it("memakai jam pulang saat sudah pulang", () => {
    expect(
      workDuration(
        row("2026-11-19T01:00:00.000Z", "2026-11-19T06:12:00.000Z"),
        0,
      ),
    ).toBe("5j 12m");
  });

  it("memakai waktu sekarang saat belum pulang", () => {
    expect(
      workDuration(
        row("2026-11-19T01:00:00.000Z", null),
        new Date("2026-11-19T03:30:00.000Z").getTime(),
      ),
    ).toBe("2j 30m");
  });

  it("mengembalikan null sebelum absen masuk", () => {
    expect(workDuration(row(null, null), Date.now())).toBeNull();
    expect(workDuration(undefined, Date.now())).toBeNull();
  });
});
