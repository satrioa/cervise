import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("navigasi setelah autentikasi", () => {
  it("login tidak memanggil refresh yang membatalkan navigasi", () => {
    const source = read("src/app/login/page.tsx");
    expect(source).toContain('router.replace(result.destination)');
    const success = source.slice(source.indexOf('toast.success("Berhasil masuk")'));
    expect(success.slice(0, 300)).not.toContain("router.refresh()");
  });

  it("logout shell tenant & owner tidak memanggil refresh setelah navigasi", () => {
    for (const path of [
      "src/components/layout/app-shell.tsx",
      "src/components/owner/owner-shell.tsx",
    ]) {
      const source = read(path);
      const body = source.slice(source.indexOf("signOut"), source.indexOf("signOut") + 500);
      expect(body, path).toContain('router.replace("/login")');
      expect(body, path).not.toContain("router.refresh()");
    }
  });
});
