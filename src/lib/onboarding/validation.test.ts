import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/tenant-slug";
import {
  BRANCH_NAME_MAX,
  TENANT_NAME_MAX,
  TENANT_SLUG_MIN,
  isTenantNameSubmittable,
  validateRequiredTenantName,
  validateTenantName,
} from "@/lib/onboarding/validation";

describe("validateTenantName", () => {
  it("accepts an ordinary business name", () => {
    expect(validateTenantName("Cervise RBM")).toBeNull();
  });

  it("accepts a name that slugs to exactly the minimum length", () => {
    expect(slugify("ABC").length).toBe(TENANT_SLUG_MIN);
    expect(validateTenantName("ABC")).toBeNull();
  });

  it("rejects a name whose slug is too short even when the name is long", () => {
    // "!! !!" is 5 karakter tapi slug-nya kosong, jadi nama yang panjang
    // tidak otomatis valid.
    expect(validateTenantName("! ! ! ! !")).toMatch(/slug/i);
  });

  it("rejects a name that is mostly punctuation", () => {
    expect(validateTenantName("!!!")).toMatch(/slug/i);
  });

  it("rejects a name longer than the maximum", () => {
    expect(validateTenantName("a".repeat(TENANT_NAME_MAX + 1))).toMatch(/maksimal/i);
    expect(validateTenantName("a".repeat(TENANT_NAME_MAX))).toBeNull();
  });

  it("treats an empty value as not-yet-filled rather than invalid", () => {
    // Form wajibnya tetap bisa menampilkan error lewat validateRequiredTenantName.
    expect(validateTenantName("")).toBeNull();
    expect(validateTenantName("   ")).toBeNull();
  });

  it("ignores surrounding whitespace when measuring", () => {
    expect(validateTenantName("   Cervise RBM   ")).toBeNull();
  });

  it("rejects a single repeated character only when the slug is too short", () => {
    expect(validateTenantName("AB")).toMatch(/slug/i);
    expect(validateTenantName("ABCDE")).toBeNull();
  });
});

describe("validateRequiredTenantName", () => {
  it("rejects an empty value", () => {
    expect(validateRequiredTenantName("")).toMatch(/wajib/i);
    expect(validateRequiredTenantName("  ")).toMatch(/wajib/i);
  });

  it("delegates to the non-required rules once something is typed", () => {
    expect(validateRequiredTenantName("!")).toMatch(/slug/i);
    expect(validateRequiredTenantName("Cervise")).toBeNull();
  });
});

describe("isTenantNameSubmittable", () => {
  it("gates the step button on the same rule the server enforces", () => {
    expect(isTenantNameSubmittable("")).toBe(false);
    expect(isTenantNameSubmittable("AB")).toBe(false);
    expect(isTenantNameSubmittable("Cervise RBM")).toBe(true);
  });
});

describe("branch name limit", () => {
  it("matches the maxLength the form puts on the input", () => {
    expect(BRANCH_NAME_MAX).toBe(50);
  });
});
