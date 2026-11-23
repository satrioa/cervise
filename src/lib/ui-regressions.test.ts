import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("regresi UI", () => {
  it("Usage menampilkan nama cabang, bukan potongan id", () => {
    const source = read("src/app/app/pengaturan/usage/pengaturan-usage-client.tsx");
    expect(source).not.toContain("branch.slice(0, 8)");
    expect(source).toContain('branches.find((b) => b.id === branch)?.name');
  });

  it("cabang menghitung hanya teknisi", () => {
    const source = read("src/app/app/cabang/actions.ts");
    expect(source).toContain('select("branch_id, role")');
    expect(source).toContain('normalizeAppRole(e.role) !== "TECHNICIAN"');
  });

  it("Lewati sparepart memakai action status, bukan RPC dengan items kosong", () => {
    const source = read("src/components/servis/sparepart-dialogs.tsx");
    expect(source).toContain("updateServisStatus(servis.id, \"Dikerjakan\")");
    expect(source).not.toContain("useSparepartsForServis(servis.id, [])");
  });

  it("saldo awal ditunda sampai password sementara diganti", () => {
    const shell = read("src/components/layout/compact-shell.tsx");
    const layout = read("src/app/app/layout.tsx");
    expect(shell).toContain('role === "FRONTLINER" && !actor.mustChangePassword');
    expect(layout).toContain("mustChangePassword: Boolean(actor.mustChangePassword)");
  });

  it("link menu sheet memakai navigasi penuh (tidak memicu removeChild SPA)", () => {
    for (const file of [
      "src/components/layout/menu-operational.tsx",
      "src/components/layout/menu-analytic.tsx",
    ]) {
      const source = read(file);
      expect(source, file).not.toContain('from "next/link"');
      expect(source, file).toContain("<a");
    }
  });
});
