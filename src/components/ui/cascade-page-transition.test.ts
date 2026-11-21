import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("overlay tidak menelan klik", () => {
  it("panel transisi bersifat dekoratif (pointer-events-none)", () => {
    const source = read("src/components/ui/CascadePageTransition.tsx");
    expect(source).not.toContain("pointer-events-auto");
    expect(source).toContain("pointer-events-none relative flex flex-1");
  });

  it("backdrop sheet melepaskan klik saat animasi tutup", () => {
    const source = read("src/components/ui/sheet.tsx");
    expect(source).toContain("data-ending-style:pointer-events-none");
  });
});
