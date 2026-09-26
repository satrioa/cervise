import { describe, expect, it } from "vitest";
import {
  OWNER_BOTTOM_TABS,
  OWNER_NAV_GROUPS,
  isOwnerNavActive,
} from "./owner-navigation";

describe("owner navigation", () => {
  it("keeps the owner navigation grouped by platform workflow", () => {
    expect(OWNER_NAV_GROUPS.map((group) => group.label)).toEqual([
      "Overview",
      "Portfolio",
      "Revenue",
      "System",
    ]);
    expect(OWNER_NAV_GROUPS[1].items.map((item) => item.href)).toEqual([
      "/owner/tenants",
      "/owner/packages",
      "/owner/accounts",
    ]);
  });

  it("marks nested owner routes as active", () => {
    expect(isOwnerNavActive("/owner/tenants/abc", "/owner/tenants")).toBe(true);
    expect(isOwnerNavActive("/owner/tenants/abc", "/owner")).toBe(false);
    expect(isOwnerNavActive("/owner", "/owner")).toBe(true);
  });

  it("uses a five-item mobile navigation", () => {
    expect(OWNER_BOTTOM_TABS).toHaveLength(5);
    expect(OWNER_BOTTOM_TABS.some((tab) => tab.more)).toBe(true);
  });
});
