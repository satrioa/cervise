import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("navigasi setelah autentikasi", () => {
  it("login memakai navigasi penuh agar Router Cache tidak menyimpan payload pra-login", () => {
    const source = read("src/app/login/page.tsx");
    const success = source.slice(source.indexOf('toast.success("Berhasil masuk")'), source.indexOf('toast.success("Berhasil masuk")') + 400);
    expect(success).toContain("window.location.assign(result.destination)");
    expect(success).not.toContain("router.replace(result.destination)");
  });

  it("semua jalur logout tidak memanggil refresh setelah navigasi", () => {
    for (const path of [
      "src/components/layout/app-shell.tsx",
      "src/components/layout/compact-bottom-bar.tsx",
      "src/components/layout/compact-menu-sheet.tsx",
      "src/components/layout/compact-sidebar.tsx",
      "src/components/layout/command-palette.tsx",
      "src/components/owner/owner-shell.tsx",
      "src/components/initial-password-dialog.tsx",
      "src/components/originkit/hero-02.tsx",
    ]) {
      const source = read(path);
      const signOutAt = source.indexOf("signOut");
      expect(signOutAt, path).toBeGreaterThan(-1);
      const body = source.slice(signOutAt, signOutAt + 500);
      expect(body, path).toMatch(/router\.replace\("\/login/);
      expect(body, path).not.toContain("router.refresh()");
    }
  });
});
