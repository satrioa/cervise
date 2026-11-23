import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/motion/pull-to-refresh.tsx"),
  "utf8",
);

describe("pull to refresh hanya di perangkat sentuh", () => {
  it("gesture hanya aktif saat pointer coarse", () => {
    expect(source).toContain('window.matchMedia("(pointer: coarse)").matches');
    expect(source).toMatch(/!isTouchPullEnabled\(\) \|\|\s*event\.touches\.length/);
    expect(source).toMatch(/!isTouchPullEnabled\(\) \|\|\s*event\.pointerType/);
  });

  it("kursor grab hanya muncul di pointer coarse", () => {
    expect(source).toContain("cursor-default [@media(pointer:coarse)]:cursor-grab");
    expect(source).toContain("[@media(pointer:coarse)]:cursor-grabbing");
    expect(source).not.toMatch(/(^|\s)["']cursor-grab["']/m);
  });
});
