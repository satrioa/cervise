import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("event notifikasi servis", () => {
  it("createServis memberi tahu teknisi, frontliner, admin", () => {
    const source = read("src/app/app/servis/actions.ts");
    expect(source).toContain("notifyRoles({");
    expect(source).toContain('event: "servis_created"');
  });

  it("status Selesai memberi tahu frontliner dan admin", () => {
    const source = read("src/app/app/servis/sparepart-actions.ts");
    expect(source).toContain('event: "servis_selesai"');
  });
});
