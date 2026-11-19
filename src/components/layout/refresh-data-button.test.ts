import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => {
  try {
    return readFileSync(join(process.cwd(), relative), "utf8");
  } catch {
    return "";
  }
};

const button = read("src/components/layout/refresh-data-button.tsx");
const servis = read("src/app/app/servis/page.tsx");
const sparepart = read("src/app/app/sparepart/sparepart-client.tsx");
const headerActions = read("src/components/inventori/inventori-header-actions.tsx");

describe("RefreshDataButton", () => {
  it("komponen client menerima callback onRefresh", () => {
    expect(button).toContain('"use client"');
    expect(button).toMatch(/onRefresh: \(\) => void \| Promise<void>/);
    expect(button).toMatch(/startTransition\(async/);
    expect(button).toMatch(/await onRefresh\(\)/);
  });

  it("spinner dan disabled mengikuti isPending", () => {
    expect(button).toMatch(/useTransition/);
    expect(button).toMatch(/isPending \? "animate-spin"/);
    expect(button).toMatch(/disabled=\{isPending\}/);
    expect(button).toContain("RefreshCw");
  });

  it("toast error sebagai fallback", () => {
    expect(button).toContain('toast.error("Gagal memuat ulang data")');
  });

  it("terpasang di tiga halaman dengan refetch yang sesuai", () => {
    expect(servis).toMatch(/<RefreshDataButton onRefresh=\{loadServis\} \/>/);
    expect(sparepart).toMatch(
      /<RefreshDataButton onRefresh=\{\(\) => reload\(q\)\} \/>/,
    );
    expect(headerActions).toMatch(
      /<RefreshDataButton onRefresh=\{\(\) => router\.refresh\(\)\} \/>/,
    );
  });
});
