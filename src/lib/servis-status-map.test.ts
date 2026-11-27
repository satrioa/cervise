import { describe, expect, it } from "vitest";
import { canPickUp, canPickUpDbStatus } from "./servis-status-map";

describe("canPickUp", () => {
  it("mengizinkan pengambilan dari Selesai", () => {
    expect(canPickUp("Selesai")).toBe(true);
  });

  it("mengizinkan pengambilan dari Batal (device dikembalikan)", () => {
    expect(canPickUp("Batal")).toBe(true);
  });

  it("menolak pengambilan dari status sebelum selesai", () => {
    for (const status of ["Masuk", "Diagnosa", "Menunggu Konfirmasi", "Menunggu Sparepart", "Dikerjakan", "Sudah Diambil"] as const) {
      expect(canPickUp(status)).toBe(false);
    }
  });
});

describe("canPickUpDbStatus", () => {
  it("menerima status DB yang setara dengan Selesai atau Batal", () => {
    expect(canPickUpDbStatus("quality_control")).toBe(true);
    expect(canPickUpDbStatus("ready")).toBe(true);
    expect(canPickUpDbStatus("cancelled")).toBe(true);
  });

  it("menolak status DB lainnya", () => {
    for (const status of ["received", "in_repair", "waiting_part", "picked_up"]) {
      expect(canPickUpDbStatus(status)).toBe(false);
    }
  });
});
