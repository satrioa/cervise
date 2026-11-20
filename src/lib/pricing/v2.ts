/**
 * Pricing v2 — kalkulasi murni, dipakai server dan (untuk pratinjau) klien.
 * Frontend tidak pernah dijadikan sumber kebenaran harga: server menghitung
 * ulang dari konfigurasi paket sebelum harga dipakai.
 */

export type CustomPricingInput = {
  branches: number;
  employees: number;
  services: number;
};

export type PricingConfig = {
  baseMonthlyPrice: number;
  includedBranches: number;
  includedEmployees: number;
  includedServices: number;
  extraBranchPrice: number;
  extraEmployeePrice: number;
  extraServiceBlockPrice: number;
  serviceBlockSize: number;
  waPerServiceBlock: number;
  includedWhatsapp: number;
  annualMultiplier: number;
};

export const defaultCustomConfig: PricingConfig = {
  baseMonthlyPrice: 999000,
  includedBranches: 3,
  includedEmployees: 15,
  includedServices: 500,
  extraBranchPrice: 79000,
  extraEmployeePrice: 12000,
  extraServiceBlockPrice: 199000,
  serviceBlockSize: 100,
  waPerServiceBlock: 300,
  includedWhatsapp: 1500,
  annualMultiplier: 10,
};

export type CustomPriceBreakdown = {
  base: number;
  branchAddon: number;
  employeeAddon: number;
  serviceAddon: number;
  total: number;
  extraServiceBlocks: number;
  whatsappQuota: number;
};

function requireCount(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} harus bilangan bulat non-negatif`);
  }
  return value;
}

/** Pembulatan ke atas: 550 tiket dengan batas 500 dihitung 1 blok, bukan 0,5. */
export function roundUpBlocks(value: number, included: number, blockSize: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Kapasitas harus bilangan bulat non-negatif");
  }
  if (!Number.isInteger(blockSize) || blockSize < 1) {
    throw new Error("Ukuran blok kapasitas tidak valid");
  }
  return Math.ceil(Math.max(0, value - included) / blockSize);
}

export function calculateCustomMonthlyPrice(
  input: CustomPricingInput,
  config: PricingConfig = defaultCustomConfig,
): CustomPriceBreakdown {
  const branches = requireCount(input.branches, "Jumlah cabang");
  const employees = requireCount(input.employees, "Jumlah karyawan");
  const services = requireCount(input.services, "Kapasitas servis");

  const branchAddon =
    Math.max(0, branches - config.includedBranches) * config.extraBranchPrice;
  const employeeAddon =
    Math.max(0, employees - config.includedEmployees) * config.extraEmployeePrice;
  const extraServiceBlocks = roundUpBlocks(
    services,
    config.includedServices,
    config.serviceBlockSize,
  );
  const serviceAddon = extraServiceBlocks * config.extraServiceBlockPrice;

  return {
    base: config.baseMonthlyPrice,
    branchAddon,
    employeeAddon,
    serviceAddon,
    total: config.baseMonthlyPrice + branchAddon + employeeAddon + serviceAddon,
    extraServiceBlocks,
    whatsappQuota:
      config.includedWhatsapp + extraServiceBlocks * config.waPerServiceBlock,
  };
}

/** Harga tahunan Custom = harga bulanan hasil kalkulasi x faktor (default 10). */
export function yearlyPrice(
  monthlyPrice: number,
  config: PricingConfig = defaultCustomConfig,
): number {
  if (!Number.isInteger(monthlyPrice) || monthlyPrice < 0) {
    throw new Error("Harga bulanan tidak valid");
  }
  return monthlyPrice * config.annualMultiplier;
}

/** Penghematan saat membayar tahunan dibanding 12x harga bulanan. */
export function annualSavings(monthlyPrice: number, annualPrice: number): number {
  return Math.max(0, monthlyPrice * 12 - annualPrice);
}

/**
 * Batas input Custom: bebas di bawah kapasitas Business. Cabang & karyawan
 * tetap minimal 1, tiket boleh 0 -- biaya tambahan tetap 0 selama masih di
 * dalam kuota Business (rumus `max(0, ...)`).
 */
export function normalizeCustomInput(input: CustomPricingInput): CustomPricingInput {
  const clamp = (value: number, min: number, max: number) => {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.trunc(value)));
  };
  return {
    branches: clamp(input.branches, 1, 1000),
    employees: clamp(input.employees, 1, 10000),
    services: clamp(input.services, 0, 100000),
  };
}

/** Konfigurasi add-on dari baris paket `custom` di database. */
export function configFromPackageRow(row: {
  monthly_price: number;
  branch_limit: number;
  user_limit: number | null;
  ticket_quota: number | null;
  whatsapp_quota: number | null;
  extra_branch_price: number | null;
  extra_employee_price: number | null;
  extra_ticket_block_price: number | null;
  ticket_block_size: number | null;
  wa_per_ticket_block: number | null;
  annual_multiplier: number | null;
}): PricingConfig {
  return {
    baseMonthlyPrice: row.monthly_price,
    includedBranches: row.branch_limit,
    includedEmployees: row.user_limit ?? defaultCustomConfig.includedEmployees,
    includedServices: row.ticket_quota ?? defaultCustomConfig.includedServices,
    extraBranchPrice: row.extra_branch_price ?? defaultCustomConfig.extraBranchPrice,
    extraEmployeePrice: row.extra_employee_price ?? defaultCustomConfig.extraEmployeePrice,
    extraServiceBlockPrice:
      row.extra_ticket_block_price ?? defaultCustomConfig.extraServiceBlockPrice,
    serviceBlockSize: row.ticket_block_size ?? defaultCustomConfig.serviceBlockSize,
    waPerServiceBlock: row.wa_per_ticket_block ?? defaultCustomConfig.waPerServiceBlock,
    includedWhatsapp: row.whatsapp_quota ?? defaultCustomConfig.includedWhatsapp,
    annualMultiplier: row.annual_multiplier ?? defaultCustomConfig.annualMultiplier,
  };
}
