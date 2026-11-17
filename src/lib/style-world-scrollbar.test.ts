import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

describe("scrollbar style world scifi", () => {
  it("hanya aktif di world scifi", () => {
    expect(css).toContain('html[data-ui-world="scifi"] *:not(.scrollbar-none)');
    expect(css).toContain("::-webkit-scrollbar-thumb");
    expect(css).toContain("scrollbar-color:");
  });

  it("tidak menimpa utility scrollbar-none", () => {
    expect(css).not.toContain('html[data-ui-world="scifi"] *::-webkit-scrollbar');
    expect(css).toContain(".scrollbar-none::-webkit-scrollbar");
  });

  it("memakai token primary scifi, bukan warna hardcoded", () => {
    const block = css.slice(
      css.indexOf('html[data-ui-world="scifi"] *:not(.scrollbar-none)'),
      css.indexOf("/* Style world: Toy"),
    );
    expect(block).toContain("var(--scifi-primary)");
    expect(block).toContain("var(--scifi-canvas)");
  });
});
