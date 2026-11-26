import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("owner accounts context menu", () => {
  const actions = read("src/app/owner/actions.ts");
  const table = read("src/components/owner/owner-accounts-table.tsx");
  const refreshTest = read("src/components/owner/owner-actions-refresh.test.ts");

  it("deleteOwnerAccount hard-deletes via auth.admin and blocks self-delete", () => {
    expect(actions).toContain("export async function deleteOwnerAccount");
    const body = actions.slice(actions.indexOf("export async function deleteOwnerAccount"));
    expect(body).toContain('throw new Error("Tidak bisa menghapus akun sendiri")');
    expect(body).toContain("auth.admin.deleteUser(userId)");
    expect(body).toContain('revalidatePath("/owner/accounts")');
  });

  it("setAccountActive updates platform admin and profile flags too", () => {
    expect(actions).toContain("export async function setAccountActive");
    const body = actions.slice(actions.indexOf("export async function setAccountActive"));
    expect(body).toContain('from("platform_admins")');
    expect(body).toContain('from("profiles")');
  });

  it("table exposes right-click menu with detail, toggle and delete", () => {
    expect(table).toContain("onContextMenu");
    expect(table).toContain("Lihat detail");
    expect(table).toContain("Nonaktifkan");
    expect(table).toContain("Hapus akun");
    expect(table).toContain("setDetailAccount");
    expect(table).toContain("setDeleteTarget");
    expect(table).toContain("router.refresh()");
  });

  it("table is covered by the client refresh regression test", () => {
    expect(refreshTest).toContain('"owner-accounts-table.tsx"');
  });
});
