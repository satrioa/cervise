import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("swipe actions pada kartu servis mobile", () => {
  const source = read("src/app/app/servis/page.tsx");

  it("memakai SwipeActions dan SwipeActionsRow dari registry", () => {
    expect(source).toContain(
      '@/components/arc/swipe-actions/swipe-actions"',
    );
    expect(source).toMatch(/<SwipeActions\b/);
    expect(source).toMatch(/<SwipeActionsRow\b/);
  });

  it("swipe kanan membuka Bayar hanya untuk servis belum lunas", () => {
    expect(source).toMatch(/leading=\{leadingActions\(r\)\}/);
    expect(source).toMatch(/getPaymentStatus\(s\) === "Lunas"/);
  });

  it("swipe kiri membuka Edit, Print, dan Delete tanpa full swipe", () => {
    expect(source).toMatch(/trailing=\{trailingActions\(r\)\}/);
    expect(source).toMatch(/fullSwipe=\{false\}/);
    for (const label of ['"Edit"', '"Print"', '"Delete"']) {
      expect(source).toContain(`label: ${label}`);
    }
    expect(source).toMatch(/keepRow: true/);
  });

  it("bottom sheet lama tetap membungkus kartu", () => {
    expect(source).toMatch(/<ServisContextMenu[\s\S]*?<SwipeActionsRow/);
  });
});
