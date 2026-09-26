import { describe, expect, it } from "vitest";
import {
  EMPLOYEE_ROLE,
  EMPLOYEE_TO_PROFILE_ROLE,
  PROFILE_ROLE,
  canManageEmployees,
} from "./account-input";

describe("canManageEmployees", () => {
  // employees_insert / employees_update hanya mengizinkan MASTER_ADMIN. Gate
  // aplikasi yang lebih longgar dari itu hanya menghasilkan penolakan RLS
  // tanpa pesan, jadi gate harus persis mengikuti database.
  it("allows only MASTER_ADMIN", () => {
    expect(canManageEmployees(EMPLOYEE_ROLE.MASTER_ADMIN)).toBe(true);
  });

  it("rejects ADMIN even though canAccess(pengaturan_general) allows it", () => {
    expect(canManageEmployees(EMPLOYEE_ROLE.ADMIN)).toBe(false);
    expect(canManageEmployees(EMPLOYEE_ROLE.FRONTLINER)).toBe(false);
    expect(canManageEmployees(EMPLOYEE_ROLE.TECHNICIAN)).toBe(false);
  });

  it("rejects missing and lowercase roles", () => {
    for (const value of [null, undefined, "", "  ", "admin", "teknisi", "super_owner"]) {
      expect(canManageEmployees(value)).toBe(false);
    }
  });

  it("is case tolerant so a legacy lowercase role still resolves", () => {
    expect(canManageEmployees("master_admin")).toBe(true);
    expect(canManageEmployees("Master_Admin")).toBe(true);
  });
});

describe("EMPLOYEE_TO_PROFILE_ROLE", () => {
  it("covers every employee role", () => {
    for (const value of Object.values(EMPLOYEE_ROLE)) {
      expect(EMPLOYEE_TO_PROFILE_ROLE[value]).toBeDefined();
    }
  });

  it("maps to the lowercase spelling profiles.role accepts", () => {
    // profiles CHECK constraint (schema.sql:20) hanya menerima huruf kecil.
    // Menulis huruf besar membuat insert ditolak, dan itulah yang membuat
    // createKaryawan gagal_total.
    for (const [employeeRole, profileRole] of Object.entries(EMPLOYEE_TO_PROFILE_ROLE)) {
      expect(profileRole).toBe(profileRole.toLowerCase());
      expect(Object.values(PROFILE_ROLE)).toContain(profileRole);
      expect(employeeRole).toBe(employeeRole.toUpperCase());
    }
  });

  it("never maps a role to itself across casings", () => {
    expect(EMPLOYEE_TO_PROFILE_ROLE[EMPLOYEE_ROLE.MASTER_ADMIN]).toBe("master_admin");
    expect(EMPLOYEE_TO_PROFILE_ROLE[EMPLOYEE_ROLE.MASTER_ADMIN]).not.toBe(EMPLOYEE_ROLE.MASTER_ADMIN);
    expect(EMPLOYEE_TO_PROFILE_ROLE[EMPLOYEE_ROLE.TECHNICIAN]).toBe("teknisi");
  });

  it("does not accept an unknown role", () => {
    expect(EMPLOYEE_TO_PROFILE_ROLE["SUPER_OWNER"]).toBeUndefined();
    expect(EMPLOYEE_TO_PROFILE_ROLE[""]).toBeUndefined();
  });
});
