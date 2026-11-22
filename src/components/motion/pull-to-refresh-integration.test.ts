import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const SHELLS = [
  "src/components/layout/compact-shell.tsx",
  "src/components/layout/app-shell.tsx",
  "src/components/owner/owner-shell.tsx",
];

describe("pull to refresh memakai komponen @beui", () => {
  it("terpasang di semua shell PWA", () => {
    for (const path of SHELLS) {
      const source = read(path);
      expect(source, path).toContain('from "@/components/motion/pull-to-refresh"');
      expect(source, path).toContain("<PullToRefresh");
      expect(source, path).toContain("onRefresh={() => window.location.reload()}");
      expect(source, path).not.toContain("usePullToRefresh(");
      expect(source, path).not.toContain("PullToRefreshIndicator");
    }
  });

  it("komponen vendored meneruskan ref & onScroll untuk logika fade/dock", () => {
    const source = read("src/components/motion/pull-to-refresh.tsx");
    expect(source).toContain("ref={setRootRef}");
    expect(source).toContain("onScroll={onScroll}");
  });
});
