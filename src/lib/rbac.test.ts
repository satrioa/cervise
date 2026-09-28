import { describe, expect, it } from "vitest";
import { canAccess, canWrite } from "./rbac";

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

/**
 * `MENU_ACCESS` dulu memakai ejaan `"teknisi"` sementara database memakai
 * `"TECHNICIAN"`, jadi `canAccess` menolak teknisi di setiap kunci. Manifest
 * baru hanya mengenal bentuk huruf besar.
 */
describe("bentuk role", () => {
  it("TECHNICIAN boleh dashboard dan servis", () => {
    expect(canAccess("TECHNICIAN", "dashboard")).toBe(true);
    expect(canAccess("TECHNICIAN", "servis")).toBe(true);
    expect(canAccess("TECHNICIAN", "/app")).toBe(true);
  });

  it("huruf kecil tetap diterima lewat normalisasi", () => {
    expect(canAccess("technician", "servis")).toBe(true);
    expect(canAccess("  admin  ", "karyawan")).toBe(true);
  });

  it("bentuk lama `teknisi` bukan lagi role yang dikenali", () => {
    expect(canAccess("teknisi", "servis")).toBe(false);
  });

  it("super_owner bukan role tenant dan ditolak", () => {
    expect(canAccess("super_owner", "karyawan")).toBe(false);
  });
});

describe("read-only", () => {
  it("ADMIN boleh membuka cabang tapi tidak menulis", () => {
    expect(canAccess("ADMIN", "cabang")).toBe(true);
    expect(canWrite("ADMIN", "cabang")).toBe(false);
  });

  it("MASTER_ADMIN tetap penuh di cabang", () => {
    expect(canWrite("MASTER_ADMIN", "cabang")).toBe(true);
  });
});
