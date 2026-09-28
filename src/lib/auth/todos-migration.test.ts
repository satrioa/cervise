import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SQL = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260925230000_add_staff_todos.sql"),
  "utf8",
).replace(/\s+/g, " ");

const OWNER_RULE = "employee_id = auth.uid() and public.can_access_tenant_branch(branch_id)";

function policyBody(action: "select" | "insert" | "update" | "delete"): string {
  const name = `cervise_staff_todos_${action}`;
  const anchor = `create policy ${name} on public.cervise_staff_todos`;
  const start = SQL.indexOf(anchor);
  expect(start, `policy ${name} harus ada`).toBeGreaterThanOrEqual(0);

  const actionAt = SQL.indexOf(`for ${action} to authenticated`, start);
  expect(actionAt, `policy ${name} harus punya "for ${action} to authenticated"`).toBeGreaterThanOrEqual(0);

  const terminator = SQL.indexOf(";", actionAt);
  return SQL.slice(actionAt, terminator + 1);
}

describe("tabel cervise_staff_todos", () => {
  it("mempunyai kolom yang dipakai dashboard", () => {
    for (const column of [
      "employee_id uuid not null references public.profiles(id) on delete cascade",
      "branch_id uuid not null references public.branches(id) on delete cascade",
      "title text not null",
      "due_at timestamptz",
      "done_at timestamptz",
    ]) {
      expect(SQL).toContain(column);
    }
  });

  it("menolak judul kosong dan terlalu panjang", () => {
    expect(SQL).toContain("check (char_length(btrim(title)) between 1 and 200)");
  });

  it("RLS diaktifkan", () => {
    expect(SQL).toContain("alter table public.cervise_staff_todos enable row level security");
  });

  it("mempunyai index untuk urutan daftar tek.tech yang akan tampil", () => {
    expect(SQL).toContain("on public.cervise_staff_todos(employee_id, done_at, due_at)");
    expect(SQL).toContain("on public.cervise_staff_todos(branch_id, done_at)");
  });

  it("tidak punya organization_id — itu denormalisasi tanpa sumber kebenaran", () => {
    expect(SQL).not.toMatch(/organization_id\s+uuid/);
  });
});

describe("To-Do bersifat personal", () => {
  it("keempat policy menyaring employee_id = auth.uid()", () => {
    for (const action of ["select", "insert", "update", "delete"] as const) {
      const body = policyBody(action);
      expect(body, `policy ${action}`).toContain(OWNER_RULE);
    }
  });

  it("policy select tidak membocorkan To-Do teknisi lain di cabang yang sama", () => {
    const body = policyBody("select");
    expect(body).toContain(OWNER_RULE);
    // Policy tidak boleh hanya mengizinkan platform admin: filter
    // kepemilikan wajib ada.    expect(body).not.toMatch(/using \(\s*public\.is_platform_admin\(\)\s*\)/);
  });

  it("policy update punya using dan with check", () => {
    const body = policyBody("update");
    expect(body).toContain("using");
    expect(body).toContain("with check");
    // filter harus muncul dua kali: sekali di using, sekali di with check.
    const occurrences = body.split(OWNER_RULE).length - 1;
    expect(occurrences).toBe(2);
  });

  it("platform admin tetap punya akses untuk keperluan operasional", () => {
    for (const action of ["select", "insert", "update", "delete"] as const) {
      expect(policyBody(action)).toContain("public.is_platform_admin()");
    }
  });
});

describe("grant", () => {
  it("authenticated mendapat DML penuh, anon tidak", () => {
    expect(SQL).toContain(
      "grant select, insert, update, delete on public.cervise_staff_todos to authenticated",
    );
    expect(SQL).toContain("revoke all on public.cervise_staff_todos from anon");
  });
});
