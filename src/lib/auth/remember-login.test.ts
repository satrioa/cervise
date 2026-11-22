import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { clearRememberedEmail, readRememberedEmail, saveRememberedEmail } from "./remember-login";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const login = read("src/app/login/page.tsx");
const helper = read("src/lib/auth/remember-login.ts");

afterEach(() => {
  clearRememberedEmail();
});

describe("simpan email login", () => {
  it("menyimpan dan membaca email, lalu bisa dihapus", () => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => void store.set(key, value),
          removeItem: (key: string) => void store.delete(key),
        },
      },
    });
    saveRememberedEmail(" owner@toko.id ");
    expect(readRememberedEmail()).toBe("owner@toko.id");
    clearRememberedEmail();
    expect(readRememberedEmail()).toBe("");
  });

  it("tidak pernah menyimpan password", () => {
    expect(helper).not.toMatch(/setItem\([^)]*password/i);
    expect(login).not.toContain("saveRememberedEmail(password");
  });
});

describe("checkbox ingat saya", () => {
  it("default centang dan memakai helper simpan/hapus", () => {
    expect(login).toContain("useState(true)");
    expect(login).toContain('id="remember-login"');
    expect(login).toContain("Ingat saya di perangkat ini");
    expect(login).toContain("saveRememberedEmail(email.trim())");
    expect(login).toContain("clearRememberedEmail()");
    expect(login).toContain("readRememberedEmail()");
  });
});
