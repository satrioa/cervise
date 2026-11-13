import { describe, expect, it } from "vitest";
import { autoCloseCutoff, shouldAutoClose } from "./auto-close";

describe("autoCloseCutoff", () => {
  it("memakai tanggal WIB, bukan tanggal UTC", () => {
    // 2026-11-13 00:30 WIB = 2026-11-12 17:30 UTC. Cutoff harus tetap
    // 13 November 03:00 WIB, bukan 12 November.
    const now = new Date("2026-11-12T17:30:00.000Z");
    expect(autoCloseCutoff(now, "03:00:00").toISOString()).toBe(
      "2026-11-12T20:00:00.000Z",
    );
  });

  it("menerima jam dari Postgres dengan detik", () => {
    const now = new Date("2026-11-13T05:00:00.000Z");
    expect(autoCloseCutoff(now, "03:30:00").toISOString()).toBe(
      "2026-11-12T20:30:00.000Z",
    );
  });
});

describe("shouldAutoClose", () => {
  const now = new Date("2026-11-13T04:00:00.000Z"); // 11:00 WIB, setelah cutoff

  it("menutup shift yang dibuka sebelum cutoff hari ini", () => {
    expect(shouldAutoClose("2026-11-12T02:00:00.000Z", now, "03:00")).toBe(true);
  });

  it("membiarkan shift yang dibuka setelah cutoff", () => {
    // 13 November 04:00 WIB — shift hari baru, tunggu cutoff besok.
    expect(shouldAutoClose("2026-11-12T21:00:00.000Z", now, "03:00")).toBe(false);
  });

  it("tidak menutup sebelum cutoff lewat", () => {
    const beforeCutoff = new Date("2026-11-12T19:00:00.000Z"); // 02:00 WIB
    expect(shouldAutoClose("2026-11-12T02:00:00.000Z", beforeCutoff, "03:00")).toBe(false);
  });

  it("mengabaikan tanggal buka yang rusak", () => {
    expect(shouldAutoClose("bukan-tanggal", now, "03:00")).toBe(false);
  });
});
