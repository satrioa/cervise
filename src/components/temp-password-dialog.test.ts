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
  it("global dan karyawan memakai builder yang sama dengan satu tombol Salin", () => {
    for (const [name, source] of [["global", shared], ["karyawan", karyawan]] as const) {
      expect(source, name).toContain("buildAccountCredentialsText");
      expect(source.match(/onClick=\{copy\}/g), name).toHaveLength(1);
      expect(source, name).not.toContain("writeText(password)");
    }
  });

  it("karyawan meneruskan PIN dari form ke modal", () => {
    expect(karyawan).toContain("onDone({ tempPassword: res.tempPassword, email: e, pin })");
    expect(list).toContain("pin: info.pin");
    expect(list).toContain("pin={temp?.pin}");
  });
});
