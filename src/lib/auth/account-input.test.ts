import { describe, expect, it } from "vitest";
import {
  EMPLOYEE_ROLE,
  PROFILE_ROLE,
  validateMasterAdminInput,
} from "./account-input";

const valid = {
  fullName: "Sari Wijaya",
  email: "Sari.Wijaya@Servisin.ID",
  phone: "08123456789",
  branchId: "branch-1",
};

describe("validateMasterAdminInput", () => {
  it("accepts a normal input and trims it", () => {
    const result = validateMasterAdminInput({ ...valid, fullName: "  Sari Wijaya  " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fullName).toBe("Sari Wijaya");
      // Email selalu dinormalisasi ke huruf kecil supaya tidak ada duplikat
      // yang berbeda casing.
      expect(result.value.email).toBe("sari.wijaya@servisin.id");
      expect(result.value.phone).toBe("08123456789");
    }
  });

  it("treats a blank phone as absent rather than an empty string", () => {
    const result = validateMasterAdminInput({ ...valid, phone: "   " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.phone).toBeNull();
  });

  it("rejects a missing or too-short name", () => {
    for (const fullName of [null, undefined, "", "  ", "A"]) {
      const result = validateMasterAdminInput({ ...valid, fullName });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("Nama");
    }
  });

  it("rejects a name longer than the column allows", () => {
    const result = validateMasterAdminInput({ ...valid, fullName: "x".repeat(81) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("80");
  });

  it("rejects malformed emails", () => {
    for (const email of ["bukan-email", "a@b", "a b@c.com", "@cervise.id", "a@.id", ""]) {
      const result = validateMasterAdminInput({ ...valid, email });
      expect(result.ok).toBe(false);
    }
  });

  it("rejects a phone containing markup", () => {
    for (const phone of ["<script>", "0812<script>", "0812/0812", "0812@x"]) {
      const result = validateMasterAdminInput({ ...valid, phone });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("telepon");
    }
  });

  it("allows the punctuation people actually type in phone numbers", () => {
    for (const phone of ["+62 812-3456-789", "(021) 123 4567", "0812 3456 789"]) {
      expect(validateMasterAdminInput({ ...valid, phone }).ok).toBe(true);
    }
  });

  it("requires a branch", () => {
    for (const branchId of [null, "", "   "]) {
      const result = validateMasterAdminInput({ ...valid, branchId });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("Cabang");
    }
  });
});

describe("role casing", () => {
  // profiles.role punya CHECK constraint huruf kecil (schema.sql:20), sedangkan
  // employees.role memakai huruf besar. Salah casing = insert ditolak database.
  it("uses lowercase for profiles and uppercase for employees", () => {
    expect(PROFILE_ROLE.MASTER_ADMIN).toBe("master_admin");
    expect(EMPLOYEE_ROLE.MASTER_ADMIN).toBe("MASTER_ADMIN");
  });

  it("never mixes the two casings", () => {
    expect(PROFILE_ROLE.MASTER_ADMIN).not.toBe(EMPLOYEE_ROLE.MASTER_ADMIN);
    for (const value of Object.values(PROFILE_ROLE)) {
      expect(value).toBe(value.toLowerCase());
    }
    for (const value of Object.values(EMPLOYEE_ROLE)) {
      expect(value).toBe(value.toUpperCase());
    }
  });
});
