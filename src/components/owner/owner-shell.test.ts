import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/owner/owner-shell.tsx"),
  "utf8",
);

describe("owner shell", () => {
  it("tidak merender bottom nav mobile", () => {
    expect(source).not.toContain("OwnerBottomNav");
    expect(source).not.toContain("Owner mobile navigation");
  });

  it("tombol settings memakai ikon grid empat kotak terisi", () => {
    expect(source).toMatch(/<LayoutGrid className="size-4" fill="currentColor" \/>/);
  });

  it("avatar akun memakai foto bila tersedia", () => {
    expect(source).toMatch(/<IdentityAvatar photoUrl=\{avatarUrl\}/);
  });
});
