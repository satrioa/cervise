import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/landing/feature-showcase.tsx"),
  "utf8",
);

const mobileBlock = source.slice(source.indexOf("Mobile:"), source.indexOf("Desktop:"));

describe("feature showcase mobile", () => {
  it("menampilkan gambar sebelum teks untuk tiap fitur", () => {
    expect(mobileBlock).toContain("FEATURES.map");
    expect(mobileBlock.match(/<figure/g)).toHaveLength(1);
    expect(mobileBlock.indexOf("<Image")).toBeLessThan(mobileBlock.indexOf("<figcaption"));
  });

  it("teks mobile bukan tombol dan tidak bisa diklik", () => {
    expect(mobileBlock).not.toContain("<button");
    expect(mobileBlock).not.toContain("onClick");
    expect(mobileBlock).toContain("<figcaption>");
  });
});
