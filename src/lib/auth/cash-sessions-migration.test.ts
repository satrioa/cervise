import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SQL = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260925240000_add_cash_sessions.sql"),
  "utf8",
).replace(/\s+/g, " ");

function policyBody(policy: string, action: "insert" | "update" | "delete" | "select"): string {
  const anchor = `create policy ${policy} on public.cervise_cash_sessions`;
  const start = SQL.indexOf(anchor);
  expect(start, `policy ${policy} harus ada`).toBeGreaterThanOrEqual(0);

  const actionAt = SQL.indexOf(`for ${action} to authenticated`, start);
  expect(actionAt, `policy ${policy} harus punya "for ${action} to authenticated"`).toBeGreaterThanOrEqual(0);

  const terminator = SQL.indexOf(";", actionAt);
  return SQL.slice(actionAt, terminator + 1);
}

describe("tabel cervise_cash_sessions", () => {
  it("mempunyai kolom yang dipakai dialog dan laporan", () => {
    for (const column of [
      "branch_id uuid not null references public.branches(id) on delete cascade",
      "employee_id uuid not null references public.profiles(id)",
      "open_at timestamptz not null default now()",
      "opening_balance integer not null check (opening_balance >= 0)",
      "closed_at timestamptz",
      "closing_balance integer check (closing_balance >= 0)",
      "expected_cash integer",
      "variance integer",
      "snapshot jsonb",
    ]) {
      expect(SQL, column).toContain(column);
    }
  });

  it("saya closed_check mengikat kolom penutup dan snapshot", () => {
    expect(SQL).toContain("cervise_cash_sessions_closed_check");
    expect(SQL).toContain(
      "(closed_at is null and closing_balance is null and snapshot is null) or (closed_at is not null and closing_balance is not null and snapshot is not null)",
    );
  });

  it("index unik hanya berlaku untuk sesi yang masih terbuka", () => {
    expect(SQL).toContain(
      "create unique index if not exists cervise_cash_sessions_open_unique on public.cervise_cash_sessions(employee_id) where closed_at is null",
    );
  });

  it("RLS diaktifkan dan anon tidak diberi akses", () => {
    expect(SQL).toContain("alter table public.cervise_cash_sessions enable row level security");
    expect(SQL).toContain("revoke all on public.cervise_cash_sessions from anon");
  });

  it("sesi tertutup tidak boleh dihapus oleh frontliner", () => {
    // Delete hanya untuk manager: Laporan Shift merujuk baris ini.
    const body = policyBody("cervise_cash_sessions_delete", "delete");
    expect(body).toContain("MASTER_ADMIN");
    expect(body).toContain("ADMIN");
    expect(body).not.toContain("FRONTLINER");
  });
});

describe("RLS cash sessions", () => {
  it("select menyaring ke sesi sendiri untuk staff", () => {
    const body = policyBody("cervise_cash_sessions_select", "select");
    expect(body).toContain("employee_id = auth.uid()");
  });

  it("select memberi manager akses ke semua sesi cabangnya", () => {
    const body = policyBody("cervise_cash_sessions_select", "select");
    expect(body.replace(/\s+/g, "")).toContain("array['MASTER_ADMIN','ADMIN']::text[]");
  });

  it("platform admin dicek lebih dulu", () => {
    for (const action of ["select", "insert", "update", "delete"] as const) {
      const body = policyBody("cervise_cash_sessions_" + action, action);
      expect(body.indexOf("public.is_platform_admin()")).toBeLessThan(
        body.indexOf("can_access_tenant_branch"),
      );
    }
  });

  it("insert hanya boleh baris dengan employee_id sendiri", () => {
    const body = policyBody("cervise_cash_sessions_insert", "insert");
    expect(body).toContain("employee_id = auth.uid()");
    expect(body.replace(/\s+/g, "")).toContain("'FRONTLINER']::text[]");
  });

  it("update punya using dan with check", () => {
    const body = policyBody("cervise_cash_sessions_update", "update");
    expect(body).toContain("using");
    expect(body).toContain("with check");
  });
});

describe("finance_tx.source", () => {
  it("menambah kolom dengan tiga nilai dan default", () => {
    expect(SQL).toContain(
      "add column if not exists source text not null default 'transaksi'",
    );
    expect(SQL).toContain("check (source in ('transaksi', 'kas_manual', 'penyesuaian'))");
  });

  it("diikutkan ke view cervise_finance_tx", () => {
    expect(SQL).toContain("create or replace view public.cervise_finance_tx");
    const viewStart = SQL.indexOf("create or replace view public.cervise_finance_tx");
    const viewBody = SQL.slice(viewStart, SQL.indexOf("from public.finance_tx", viewStart));
    expect(viewBody).toContain("source");
  });

  it("policy write finance_tx tidak dilonggarkan", () => {
    // Kas manual FRONTLINER sudah diizinkan finance_insert
    // (20260925122000:267-269), jadi tidak perlu policy baru. Kalau file ini
    // diam-diam menambahkan FRONTLINER ke update/delete, itu perubahan
    // yang tidak diminta.
    expect(SQL).not.toContain("create policy finance_");
  });
});

describe("cervise_sales.servis_id", () => {
  it("menambah kolom pengait yang nullable", () => {
    expect(SQL).toContain("add column if not exists servis_id uuid");
    expect(SQL).toContain("references public.cervise_services(id) on delete set null");
  });

  it("mempunyai index parsial untuk baris yang punya pengait", () => {
    expect(SQL).toContain(
      "create index if not exists cervise_sales_servis_idx on public.cervise_sales(servis_id) where servis_id is not null",
    );
  });

  it("tidak menambah kolom wajib pada penjualan barang", () => {
    // Tidak ada NOT NULL dan tidak ada CHECK: penjualan barang tidak punya
    // servis, dan baris lama tidak boleh ikut berubah.
    const line = SQL.slice(SQL.indexOf("add column if not exists servis_id"));
    const statement = line.slice(0, line.indexOf(";"));
    expect(statement).not.toContain("not null");
    expect(statement).not.toContain("default");
  });
});

describe("bentuk migration", () => {
  it("menyebut spec sumber di komentar", () => {
    expect(SQL).toContain("2026-09-28-frontliner-cash-and-shift-report-design.md");
  });

  it("tidak menghapus tabel atau kolom yang ada", () => {
    expect(SQL).not.toMatch(/drop\s+table/i);
    expect(SQL).not.toMatch(/drop\s+column/i);
  });
});
