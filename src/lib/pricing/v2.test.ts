import { describe, expect, it } from "vitest";
import {
  calculateCustomMonthlyPrice,
  defaultCustomConfig,
  roundUpBlocks,
  yearlyPrice,
} from "./v2";

const config = defaultCustomConfig;

describe("pricing v2", () => {
  it("membulatkan kapasitas tambahan per 100 tiket ke atas", () => {
    expect(roundUpBlocks(550, 500, 100)).toBe(1);
    expect(roundUpBlocks(700, 500, 100)).toBe(2);
    expect(roundUpBlocks(500, 500, 100)).toBe(0);
  });

  it("harga dasar Business tanpa tambahan", () => {
    const result = calculateCustomMonthlyPrice(
      { branches: 3, employees: 15, services: 500 },
      config,
    );
    expect(result).toMatchObject({
      base: 999000,
      branchAddon: 0,
      employeeAddon: 0,
      serviceAddon: 0,
      total: 999000,
      extraServiceBlocks: 0,
      whatsappQuota: 1500,
    });
  });

  it.each([
    [{ branches: 4, employees: 15, services: 500 }, 1078000],
    [{ branches: 4, employees: 20, services: 500 }, 1138000],
    [{ branches: 5, employees: 25, services: 700 }, 1675000],
    [{ branches: 8, employees: 40, services: 1000 }, 2689000],
    [{ branches: 10, employees: 60, services: 1500 }, 4082000],
  ] as const)("menghitung harga custom %o", (input, expected) => {
    expect(calculateCustomMonthlyPrice(input, config).total).toBe(expected);
  });

  it("memberi 300 pesan WA per tambahan 100 tiket", () => {
    const result = calculateCustomMonthlyPrice(
      { branches: 5, employees: 25, services: 700 },
      config,
    );
    expect(result.extraServiceBlocks).toBe(2);
    expect(result.whatsappQuota).toBe(1500 + 2 * 300);
  });

  it("harga tahunan custom = harga bulanan x 10", () => {
    expect(yearlyPrice(999000, config)).toBe(9990000);
    expect(yearlyPrice(1675000, config)).toBe(16750000);
  });
});
