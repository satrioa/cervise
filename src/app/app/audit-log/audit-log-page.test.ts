import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/table-audit-log.tsx"),
  "utf8",
);

describe("audit log tidak memicu soft navigation saat sinkron URL", () => {
  it("memakai history.replaceState, bukan router.replace", () => {
    // router.replace() saat mount melakukan soft navigation. Shell sudah
    // memaksa navigasi penuh karena commit React soft nav bisa gagal
    // (removeChild null) dan membuat seluruh halaman mati sampai refresh.
    expect(source).toContain("window.history.replaceState");
    expect(source).not.toContain("router.replace");
    expect(source).not.toContain("useRouter");
  });
});
