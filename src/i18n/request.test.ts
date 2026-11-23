import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/i18n/request.ts"),
  "utf8",
);

describe("i18n request config aman di Worker", () => {
  it("tidak memakai dynamic import untuk messages", () => {
    expect(source).not.toMatch(/import\s*\(\s*`/);
    expect(source).not.toMatch(/\$\{locale\}/);
  });

  it("memakai peta statis untuk semua locale", () => {
    expect(source).toMatch(/from "\.\.\/\.\.\/messages\/id\.json"/);
    expect(source).toMatch(/from "\.\.\/\.\.\/messages\/en\.json"/);
    expect(source).toMatch(/messages\[locale/);
  });
});
