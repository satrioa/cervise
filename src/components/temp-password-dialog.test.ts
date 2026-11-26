import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAccountCredentialsText } from "./temp-password-dialog";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const shared = read("src/components/temp-password-dialog.tsx");
const karyawan = read("src/components/karyawan/karyawan-form-dialog.tsx");
const list = read("src/components/karyawan/karyawan-list.tsx");

describe("salin kredensial akun baru", () => {
  it("satu teks memuat email, password, dan PIN jika ada", () => {
    const text = buildAccountCredentialsText({
      email: "owner@toko.id",
      password: "Rahasia123!",
      pin: "123456",
    });
    expect(text).toBe("Email: owner@toko.id\nPassword: Rahasia123!\nPIN: 123456");
  });

  it("PIN tidak ditambahkan saat tidak diisi", () => {
    expect(
      buildAccountCredentialsText({ email: "a@b.id", password: "x", pin: "" }),
    ).toBe("Email: a@b.id\nPassword: x");
  });
});

describe("modal akun baru", () => {
  it("global memakai CopyButton @uiarc dengan fallback clipboard", () => {
    expect(shared).toContain("buildAccountCredentialsText");
    expect(shared).toContain('from "@/components/arc/copy-button/copy-button"');
    expect(shared).toContain("<CopyButton");
    expect(shared).toContain('label="Salin"');
    expect(shared).not.toContain("navigator.clipboard.writeText");

    const helper = read("src/components/arc/lib/use-copy-feedback.ts");
    expect(helper).toContain("document.execCommand");
    expect(helper).toContain("navigator.clipboard");
  });

  it("karyawan memakai modal global, bukan dialog salin ganda", () => {
    expect(karyawan).toContain('from "@/components/temp-password-dialog"');
    expect(karyawan).not.toContain("export function TempPasswordDialog");
    expect(list).toContain('from "@/components/temp-password-dialog"');
  });

  it("karyawan meneruskan PIN dari form ke modal", () => {
    expect(karyawan).toContain("onDone({ tempPassword: res.tempPassword, email: e, pin })");
    expect(list).toContain("pin: info.pin");
    expect(list).toContain("pin={temp?.pin}");
  });

  it("modal kredensial dipasang setelah form keluar dan sebelum refresh", () => {
    // Dua dialog yang mount bareng membuat modal scope yang masih keluar
    // menandai popup baru inert — tombol terlihat tapi tidak bisa diklik.
    const start = karyawan.indexOf("setTimeout(");
    expect(start).toBeGreaterThan(-1);
    expect(karyawan.slice(start, start + 160)).toContain("onDone");
    const actions = list.slice(list.indexOf("export function KaryawanHeaderActions"));
    expect(actions.indexOf("setTemp(")).toBeLessThan(actions.indexOf("router.refresh()"));
  });
});
