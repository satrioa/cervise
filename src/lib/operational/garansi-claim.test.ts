import { describe, expect, it } from "vitest";
import { canClaimGaransi, type GaransiClaimEligibilityInput } from "./garansi-claim";

const NOW = new Date("2026-11-27T00:00:00Z");

function input(overrides: Partial<GaransiClaimEligibilityInput> = {}): GaransiClaimEligibilityInput {
  return {
    status: "Sudah Diambil",
    garansiUntil: "2026-12-27T00:00:00Z",
    garansiValue: 30,
    garansiUnit: "hari",
    hasOpenClaim: false,
    now: NOW,
    ...overrides,
  };
}

describe("canClaimGaransi", () => {
  it("mengizinkan klaim saat garansi masih aktif", () => {
    expect(canClaimGaransi(input()).eligible).toBe(true);
  });

  it("mengizinkan klaim saat garansi segera habis", () => {
    expect(canClaimGaransi(input({ garansiUntil: "2026-11-29T00:00:00Z" })).eligible).toBe(true);
  });

  it("menolak garansi expired", () => {
    const result = canClaimGaransi(input({ garansiUntil: "2026-11-26T00:00:00Z" }));
    expect(result.eligible).toBe(false);
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it("menolak garansi belum aktif", () => {
    expect(canClaimGaransi(input({ garansiUntil: null })).eligible).toBe(false);
  });

  it("menolak servis yang belum Sudah Diambil", () => {
    expect(canClaimGaransi(input({ status: "Dikerjakan" })).eligible).toBe(false);
  });

  it("menolak bila sudah ada klaim berjalan", () => {
    const result = canClaimGaransi(input({ hasOpenClaim: true }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("klaim");
  });
});
