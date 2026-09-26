import { describe, expect, it } from "vitest";
import { canSwitchTenant, canSwitchBranch } from "./access";

describe("tenant and branch switch access", () => {
  it("allows only master admins to switch tenants", () => {
    expect(canSwitchTenant("MASTER_ADMIN")).toBe(true);
    expect(canSwitchTenant("ADMIN")).toBe(false);
    expect(canSwitchTenant("FRONTLINER")).toBe(false);
    expect(canSwitchTenant("TECHNICIAN")).toBe(false);
  });

  it("allows only master admins to switch branches", () => {
    expect(canSwitchBranch("MASTER_ADMIN")).toBe(true);
    expect(canSwitchBranch("ADMIN")).toBe(false);
    expect(canSwitchBranch("FRONTLINER")).toBe(false);
    expect(canSwitchBranch("TECHNICIAN")).toBe(false);
  });

  it("normalizes legacy role casing", () => {
    expect(canSwitchTenant("master_admin")).toBe(true);
    expect(canSwitchBranch("master_admin")).toBe(true);
  });
});
