import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import data from "@/content/changelog.json";
import { CHANGE_LABELS, formatReleaseDate, releases, releaseTag, releaseUrl } from "@/lib/changelog";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");
const page = read("src/app/changelog/page.tsx");
const landing = read("src/app/page.tsx");
const nav = read("src/components/owner/owner-navigation.tsx");

describe("content/changelog.json", () => {
  it("memiliki entri dengan field lengkap", () => {
    expect(data.releases.length).toBeGreaterThan(0);
    for (const release of data.releases) {
      expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(release.title.length).toBeGreaterThan(0);
      expect(release.summary.length).toBeGreaterThan(0);
      for (const kind of Object.keys(CHANGE_LABELS)) {
        expect(Array.isArray(release.changes[kind as keyof typeof release.changes])).toBe(true);
      }
    }
  });

  it("diurutkan dari rilis terbaru", () => {
    const dates = releases.map((release) => release.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("versi unik dan menghasilkan tag GitHub yang benar", () => {
    const versions = releases.map((release) => release.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect(releaseTag("1.0.0")).toBe("v1.0.0");
    expect(releaseUrl("1.0.0")).toContain("/releases/tag/v1.0.0");
    expect(formatReleaseDate("2026-11-21")).toContain("2026");
  });
});

describe("Halaman Changelog", () => {
  it("merender daftar rilis dengan scope terang", () => {
    expect(page).toContain("landing-light");
    expect(page).toContain('themeColor: "#ffffff"');
    expect(page).toContain("releases.map((release)");
    expect(page).toContain("<ReleaseCard");
  });

  it("ditautkan dari footer landing dan menu owner", () => {
    expect(landing).toContain('{ name: "Changelog", url: "/changelog" }');
    expect(nav).toContain('{ label: "Changelog", href: "/changelog", icon: HistoryIcon }');
  });
});
