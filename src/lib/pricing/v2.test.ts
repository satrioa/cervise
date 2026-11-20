import { describe, expect, it } from "vitest";
import {
  calculateCustomMonthlyPrice,
  defaultCustomConfig,
  normalizeCustomInput,
  roundUpBlocks,
  yearlyPrice,
} from "./v2";

const config = defaultCustomConfig;

describe("pricing v2", () => {
  it("minimum Custom mengikuti paket Starter", () => {
    const input = normalizeCustomInput({ branches: 1, employees: 1, services: 0 });
    expect(input).toEqual({ branches: 1, employees: 5, services: 100 });
    expect(calculateCustomMonthlyPrice(input, config).total).toBe(299000);
  });

  it("membulatkan kapasitas tambahan per 100 tiket ke atas", () => {
    expect(roundUpBlocks(550, 500, 100)).toBe(1);
    expect(roundUpBlocks(700, 500, 100)).toBe(2);
    expect(roundUpBlocks(500, 500, 100)).toBe(0);
  });

  it("harga dasar Starter tanpa tambahan", () => {
    const result = calculateCustomMonthlyPrice(
      { branches: 1, employees: 5, services: 100 },
      config,
    );
    expect(result).toMatchObject({
      base: 299000,
      branchAddon: 0,
      employeeAddon: 0,
      serviceAddon: 0,
      total: 299000,
      extraServiceBlocks: 0,
      whatsappQuota: 300,
    });
  });

  it.each([
    [{ branches: 4, employees: 15, services: 500 }, 1452000],
    [{ branches: 4, employees: 20, services: 500 }, 1512000],
    [{ branches: 5, employees: 25, services: 700 }, 2049000],
    [{ branches: 8, employees: 40, services: 1000 }, 3063000],
    [{ branches: 10, employees: 60, services: 1500 }, 4456000],
  ] as const)("menghitung harga custom %o", (input, expected) => {
    expect(calculateCustomMonthlyPrice(input, config).total).toBe(expected);
  });

  it("memberi 300 pesan WA per tambahan 100 tiket di atas Starter", () => {
    const result = calculateCustomMonthlyPrice(
      { branches: 5, employees: 25, services: 700 },
      config,
    );
    expect(result.extraServiceBlocks).toBe(6);
    expect(result.whatsappQuota).toBe(300 + 6 * 300);
  });

  it("harga tahunan custom = harga bulanan x 10 (hemat ±17%)", () => {
    expect(yearlyPrice(299000, config)).toBe(2990000);
    expect(yearlyPrice(2049000, config)).toBe(20490000);
  });
});
