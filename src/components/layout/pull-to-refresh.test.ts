import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PULL_REFRESH_THRESHOLD, shouldTriggerRefresh } from "./pull-to-refresh";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("pull to refresh", () => {
  it("hanya memicu setelah melewati ambang", () => {
    expect(shouldTriggerRefresh(PULL_REFRESH_THRESHOLD - 1)).toBe(false);
    expect(shouldTriggerRefresh(PULL_REFRESH_THRESHOLD)).toBe(true);
    expect(shouldTriggerRefresh(120)).toBe(true);
  });

  it("touchmove dipasang non-passive supaya bounce Safari bisa dicegah", () => {
    const source = read("src/components/layout/pull-to-refresh.tsx");
    expect(source).toContain('passive: false');
    expect(source).toContain('(pointer: coarse)');
  });

  it("terpasang di semua shell PWA", () => {
    for (const path of [
      "src/components/layout/compact-shell.tsx",
      "src/components/layout/app-shell.tsx",
      "src/components/owner/owner-shell.tsx",
    ]) {
      const source = read(path);
      expect(source, path).toContain("usePullToRefresh(");
      expect(source, path).toContain("<PullToRefreshIndicator");
      expect(source, path).toContain("overscroll-y-contain");
    }
  });
});
