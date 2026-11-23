import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/app/servis/page.tsx"),
  "utf8",
);

describe("haptic drag kanban servis", () => {
  it("bergetar sekali saat kartu mulai terangkat", () => {
    expect(source).toContain('import { haptic } from "@/lib/haptic"');
    const start = source.indexOf("onDragStart={(event) => {");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, start + 400);
    expect(body).toContain("haptic()");
  });
});

describe("filter status servis", () => {
  it("memakai PTabs10 (@coss/p-tabs-10), bukan JellyRadio", () => {
    expect(source).toContain('import { PTabs10 } from "@/components/p-tabs-10"');
    expect(source).toContain("<PTabs10");
    expect(source).not.toContain("JellyRadio");
  });

  it("jumlah tab dihitung dari data yang sudah difilter selain status", () => {
    expect(source).toContain("statusTabItems");
    expect(source).toMatch(/count: filteredByAll\.length/);
    expect(source).toMatch(/filteredByAll\.filter\(\(item\) => item\.status === s\.key\)/);
  });

  it("lebar tabs mengikuti lebar konten tabel", () => {
    expect(source).toMatch(/hidden w-full overflow-x-auto scrollbar-none pb-3 md:block/);
    expect(source).not.toMatch(/mx-auto w-fit/);
  });

  it("tabel punya kolom Tanggal Masuk tersendiri di paling kiri", () => {
    expect(source).toContain("<TableHead>Tanggal Masuk</TableHead><TableHead>Servis</TableHead>");
    expect(source).toMatch(/<TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">\{format\(new Date\(r\.date\)/);
    expect(source).toMatch(/colSpan=\{8\}/);
  });
});
