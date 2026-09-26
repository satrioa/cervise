import { describe, expect, it } from "vitest";
import { canAccess } from "./rbac";

describe("server role access", () => {
  it("accepts uppercase database roles", () => {
    expect(canAccess("MASTER_ADMIN", "karyawan")).toBe(true);
    expect(canAccess("ADMIN", "cabang")).toBe(true);
  });

  it("rejects roles outside a menu policy", () => {
    expect(canAccess("TECHNICIAN", "karyawan")).toBe(false);
    expect(canAccess("FRONTLINER", "keuangan_transaksi")).toBe(false);
  });

  it("keeps customer access available to frontliners", () => {
    expect(canAccess("FRONTLINER", "customer")).toBe(true);
  });

  it("reserves price and discount overrides for admins", () => {
    expect(canAccess("ADMIN", "harga_jual")).toBe(true);
    expect(canAccess("MASTER_ADMIN", "harga_jual")).toBe(true);
    expect(canAccess("FRONTLINER", "harga_jual")).toBe(false);
    expect(canAccess("TECHNICIAN", "harga_jual")).toBe(false);
  });
});
