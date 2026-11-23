import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/public/servis-result-card.tsx"),
  "utf8",
);

describe("strip status horizontal halaman lacak", () => {
  it("memakai kolom tetap dan connector yang sejajar", () => {
    expect(source).toContain("grid min-w-[34rem] grid-cols-8 sm:min-w-0");
    expect(source).toContain("absolute left-0 right-1/2 top-3.5 h-0.5");
  });

  it("menandai langkah selesai dengan check dan kondisi Batal", () => {
    expect(source).toContain("done ? <CheckIcon");
    expect(source).toContain('active && cancelled && "border-destructive');
  });

  it("tidak lagi memakai fade mask yang membuat tepi kabur", () => {
    expect(source).not.toContain("maskImage");
    expect(source).not.toContain("orientation=\"horizontal\"");
  });
});
