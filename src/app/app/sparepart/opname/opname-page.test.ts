import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");
const list = read("src/app/app/inventori/opname/opname-client.tsx");

describe("OpnameClient dengan domain terkunci", () => {
  it("menerima lockedDomain dan memakainya sebagai state awal", () => {
    expect(list).toContain("lockedDomain?: Domain");
    expect(list).toContain('useState<Domain>(lockedDomain ?? "product")');
  });

  it("menyembunyikan tab saat terkunci dan tetap memakai SessionList", () => {
    expect(list).toContain("{lockedDomain ? (");
    expect(list).toContain("sessions={sessions[lockedDomain]}");
    expect(list).toContain("<TabsList>");
  });
});
