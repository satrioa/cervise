import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

describe("script no-flash tema", () => {
  it("memakai next/script beforeInteractive, bukan tag script React", () => {
    expect(source).toContain('import Script from "next/script"');
    expect(source).toMatch(/<Script\s+id="cervise-theme-no-flash"\s+strategy="beforeInteractive">/);
    expect(source).not.toMatch(/<script\s+dangerouslySetInnerHTML/);
  });
});
