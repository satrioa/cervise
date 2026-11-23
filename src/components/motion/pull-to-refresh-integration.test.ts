import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const SHELLS = [
  "src/components/layout/compact-shell.tsx",
  "src/components/layout/app-shell.tsx",
  "src/components/owner/owner-shell.tsx",
];

describe("pull to refresh tidak mengganggu navigasi & klik", () => {
  it("semua shell memakai hook ringan, bukan wrapper motion", () => {
    for (const path of SHELLS) {
      const source = read(path);
      expect(source, path).toContain('from "@/components/layout/pull-to-refresh"');
      expect(source, path).toContain("usePullToRefresh(");
      expect(source, path).toContain("<PullToRefreshIndicator");
      expect(source, path).not.toContain('from "@/components/motion/pull-to-refresh"');
      expect(source, path).not.toContain("<PullToRefresh\n");
    }
  });

  it("hook tidak memakai AnimatePresence / pointer capture", () => {
    const source = read("src/components/layout/pull-to-refresh.tsx");
    expect(source).not.toContain("AnimatePresence");
    expect(source).not.toContain("setPointerCapture");
    expect(source).not.toContain("motion.div");
    expect(source).toContain("touchmove");
    expect(source).toContain("passive: false");
  });
});
