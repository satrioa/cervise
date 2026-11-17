import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/app/pengaturan/role/role-manager.tsx"),
  "utf8",
);

describe("tampilan kelola role", () => {
  it("memakai PageHeader dan primitif tabel yang konsisten", () => {
    expect(source).toContain('import { PageHeader } from "@/components/layout/page-header"');
    expect(source).toContain("<PageHeader");
    expect(source).toContain("<TableHead");
    expect(source).toContain("<TableBody>");
    expect(source).not.toMatch(/<tbody>/);
  });

  it("form buat/edit pakai Dialog + Field + Checkbox, bukan div putih mentah", () => {
    expect(source).toContain("<Dialog open={form !== null}");
    expect(source).toContain("<Field");
    expect(source).toContain("<Checkbox");
    expect(source).not.toContain('bg-white rounded-xl p-6');
    expect(source).not.toContain("accent-brand-600");
    expect(source).not.toMatch(/fixed inset-0 z-50 bg-black\/50/);
  });

  it("notifikasi memakai sonner, bukan toast div buatan sendiri", () => {
    expect(source).toContain('import { toast } from "sonner"');
    expect(source).toContain("toast.success");
    expect(source).toContain("toast.error");
    expect(source).not.toContain("fixed bottom-6 right-6");
  });
});
