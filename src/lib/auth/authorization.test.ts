import { describe, expect, it } from "vitest";
import {
  getProtectedPathKind,
  getTenantAccessRedirect,
  isEmployeeTargetInOrganization,
  isManagerRole,
  isSalesRole,
  normalizeRole,
} from "./authorization";

describe("authorization helpers", () => {
  it("normalizes database and UI role casing", () => {
    expect(normalizeRole(" master_admin ")).toBe("MASTER_ADMIN");
    expect(normalizeRole("ADMIN")).toBe("ADMIN");
    expect(normalizeRole(null)).toBeNull();
  });

  it("recognizes manager roles", () => {
    expect(isManagerRole("admin")).toBe(true);
    expect(isManagerRole("MASTER_ADMIN")).toBe(true);
    expect(isManagerRole("frontliner")).toBe(false);
  });

  it("recognizes sales roles", () => {
    expect(isSalesRole("frontliner")).toBe(true);
    expect(isSalesRole("MASTER_ADMIN")).toBe(true);
    expect(isSalesRole("technician")).toBe(false);
  });

  it("rejects employee targets outside the actor organization", () => {
    const target = {
      organization_id: "org-a",
      branch_id: "branch-a",
      profile_id: "profile-a",
    };

    expect(isEmployeeTargetInOrganization(target, "org-a", "branch-a")).toBe(true);
    expect(isEmployeeTargetInOrganization(target, "org-b", "branch-a")).toBe(false);
    expect(isEmployeeTargetInOrganization(target, "org-a", "branch-b")).toBe(false);
  });

  it("maps tenant access failures to safe destinations", () => {
    expect(getTenantAccessRedirect("unauthenticated")).toBe("/login?next=/app");
    expect(getTenantAccessRedirect("tenant_not_found")).toBe("/onboarding");
    expect(getTenantAccessRedirect("branch_invalid")).toBe("/login?error=tenant-access-denied");
    expect(getTenantAccessRedirect("profile_inactive")).toBe("/login?error=tenant-access-denied");
    expect(getTenantAccessRedirect("assignment_required")).toBe("/account/assignment-required");
  });

  it("mengarahkan langganan yang berakhir ke halaman tagihan, bukan ke login", () => {
    // Ini yang memperbaiki jalan buntu: sebelumnya tenant yang trial-nya habis
    // terpental ke /login tanpa penjelasan, sementara halaman yang dipakai
    // untuk membayar ikut terkunci. Sekarang keduanya bertemu di satu tempat.
    expect(getTenantAccessRedirect("subscription_expired")).toBe(
      "/app/pengaturan/subscription?reason=trial-ended",
    );
    expect(getTenantAccessRedirect("subscription_blocked")).toBe(
      "/app/pengaturan/subscription?reason=blocked",
    );
  });

  it("memisahkan masalah tagihan dari masalah akun", () => {
    // `branch_invalid` dan `profile_inactive` tetap ke login. Mengarahkannya
    // ke halaman paket akan menampilkan pilihan bayar untuk masalah yang
    // sebenarnya adalah data akun yang salah - satu langganan tidak akan
    // memperbaikinya.
    const redirect = getTenantAccessRedirect("branch_invalid");
    expect(redirect).not.toContain("subscription");
    expect(getTenantAccessRedirect("profile_inactive")).not.toContain("subscription");
  });

  it("detects protected paths after locale prefixes", () => {
    expect(getProtectedPathKind("/en/app")).toBe("app");
    expect(getProtectedPathKind("/id/dashboard/tenant/acme")).toBe("tenant");
    expect(getProtectedPathKind("/login")).toBeNull();
  });
});
