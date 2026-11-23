import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("FAQ landing page", () => {
  const source = read("src/components/landing/faq-section.tsx");
  const page = read("src/app/page.tsx");

  it("dipasang sebelum footer di landing page", () => {
    expect(page).toContain("FaqSection");
    const faq = page.indexOf("<FaqSection");
    const footer = page.indexOf("<FooterSimple");
    expect(faq).toBeGreaterThan(-1);
    expect(faq).toBeLessThan(footer);
  });

  it("memakai accordion Coss dengan satu item terbuka", () => {
    expect(source).toContain('from "@/components/ui/accordion"');
    expect(source).toContain("<Accordion");
    expect(source).not.toMatch(/<Accordion[^>]*\bmultiple\b/);
    expect(source).toMatch(/defaultValue=\{\["faq-1"\]\}/);
  });

  it("memuat enam pertanyaan", () => {
    const items = source.match(/value="faq-\d+"/g) ?? [];
    expect(items).toHaveLength(6);
  });

  it("memiliki anchor #faq", () => {
    expect(source).toContain('id="faq"');
    expect(page).toMatch(/\{ name: "FAQ", url: "#faq" \}/);
  });
});
