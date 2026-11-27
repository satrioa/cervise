import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/app/actions/notifications.ts"),
  "utf8",
);

describe("server action notifikasi", () => {
  it("mengambil role dari sesi, bukan dari argumen client", () => {
    expect(source).toContain("getActiveTenant()");
    expect(source).toMatch(/getNotifications\(\)\s*:/);
    expect(source).not.toMatch(/getNotifications\([^)]*role/);
  });

  it("memfilter cabang untuk non-admin", () => {
    expect(source).toContain('actor.role === "MASTER_ADMIN" || actor.role === "ADMIN"');
    expect(source).toContain('.eq("branch_id", actor.branchId)');
  });

  it("menulis read receipt memakai auth.uid()", () => {
    expect(source).toContain("supabase.auth.getUser()");
    expect(source).toContain("user_id: user.id");
  });
});
