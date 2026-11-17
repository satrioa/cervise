import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/app/app/pengaturan/pengaturan-client.tsx"),
  "utf8",
);

describe("form Akses Master Admin", () => {
  it("disembunyikan sampai tombol Tambah Akun Master ditekan", () => {
    expect(source).toContain('const [showCreateAdmin, setShowCreateAdmin] = useState(false)');
    expect(source).toContain("Tambah Akun Master");
    expect(source).toMatch(/onClick=\{\(\) => setShowCreateAdmin\(true\)\}/);
    expect(source).toMatch(/\{showCreateAdmin \? \(/);
  });

  it("punya tombol Batal yang menutup dan mengosongkan form", () => {
    const start = source.indexOf("Batal");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(Math.max(0, start - 900), start);
    expect(body).toContain("setShowCreateAdmin(false)");
    expect(body).toContain('setMaName("")');
    expect(body).toContain('setMaEmail("")');
    expect(body).toContain('setMaPhone("")');
  });

  it("form ditutup setelah akun berhasil dibuat", () => {
    const createStart = source.indexOf("const handleCreateMasterAdmin");
    const createEnd = source.indexOf("return (", createStart);
    const body = source.slice(createStart, createEnd);
    expect(body).toContain("setShowCreateAdmin(false)");
  });
});
