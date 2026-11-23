# Log Harian Kiosk & Tombol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tabel log harian kiosk menampilkan absen karyawan, state tombol Masuk/Pulang mengikuti data hari ini, dan tombol Pulang berwarna merah.

**Architecture:** Halaman kiosk menerjemahkan `employeeId` (employees.id) dari sesi menjadi `profile_id` lewat tabel `employees`, lalu memfilter view `attendance_rekap` dengan `profile_id` tersebut. Tidak ada perubahan DB/RPC/sesi.

**Tech Stack:** Next.js 16 App Router, Supabase admin client, vitest, Tailwind/Button variant.

**Spec:** `docs/superpowers/specs/2026-11-19-kiosk-log-table-and-buttons-design.md`

## Global Constraints

- `session.employeeId` tetap `employees.id` (dibutuhkan RPC `submit_attendance_pin`).
- `attendance_records.employee_id` adalah `profiles.id`.
- Tombol Masuk disabled saat `check_in_at` ada; Pulang aktif hanya saat sudah masuk & belum pulang.
- Tombol Pulang memakai `variant="destructive"`.

## Review Focus

| Input / kondisi | Perilaku yang diharapkan | Test ada di |
| --- | --- | --- |
| Sesi berisi employees.id | Query log memakai profile_id hasil lookup | Task 1 |
| Belum ada check-in | Masuk aktif, Pulang disabled | Task 2 (kode existing, diverifikasi manual) |
| Sudah check-in, belum pulang | Masuk disabled, Pulang merah & aktif | Task 2 |
| Sudah pulang | Keduanya disabled | Task 2 |

---

### Task 1: Filter log dengan profile_id

**Files:** Modify `src/app/absen-kiosk/page.tsx`; Test `src/app/absen-kiosk/page.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

```ts
// src/app/absen-kiosk/page.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, eqCalls, readSessionMock } = vi.hoisted(() => {
  const eqCalls: Array<[string, unknown]> = [];
  const fromMock = vi.fn((table: string) => ({
    select: () => ({
      eq: (col: string, value: unknown) => {
        eqCalls.push([col, value]);
        if (table === "employees") {
          return { maybeSingle: async () => ({ data: { profile_id: "profile-1" }, error: null }) };
        }
        return { order: () => ({ limit: async () => ({ data: [], error: null }) }) };
      },
    }),
  }));
  return { fromMock, eqCalls, readSessionMock: vi.fn() };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: fromMock }) }));
vi.mock("./actions", () => ({ readSession: readSessionMock }));

import AbsenKioskPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  eqCalls.length = 0;
  readSessionMock.mockResolvedValue({
    employeeId: "emp-row-1", organizationId: "org-1", branchId: "b-1",
    name: "Budi", exp: Date.now() + 60_000,
  });
});

describe("AbsenKioskPage", () => {
  it("memfilter log dengan profile_id, bukan employee row id", async () => {
    await AbsenKioskPage();
    expect(eqCalls).toContainEqual(["id", "emp-row-1"]);
    expect(eqCalls).toContainEqual(["employee_id", "profile-1"]);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/app/absen-kiosk/page.test.ts` — Expected: FAIL (filter masih memakai `emp-row-1`).
- [ ] **Step 3: Implementasi** — di `page.tsx`, setelah `readSession()`:

```ts
  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("profile_id")
    .eq("id", session.employeeId)
    .maybeSingle();
  if (employeeError) throw new Error(employeeError.message);
```

lalu ubah filter log:

```ts
    .eq("employee_id", employee?.profile_id ?? "")
```

- [ ] **Step 4:** Run `npx vitest run src/app/absen-kiosk/page.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `git add src/app/absen-kiosk/page.tsx src/app/absen-kiosk/page.test.ts && git commit -m "fix(absen-kiosk): filter log by profile id"`

---

### Task 2: Tombol Pulang merah & verifikasi

**Files:** Modify `src/app/absen-kiosk/kiosk-client.tsx`

- [ ] **Step 1:** Ubah tombol Pulang:

```tsx
        <Button
          variant="destructive"
          disabled={pending || !sudahMasuk || sudahPulang}
          onClick={() => absen("check_out")}
        >
          Absen Pulang
        </Button>
```

Tombol Masuk tidak diubah (`disabled={pending || sudahMasuk}`).

- [ ] **Step 2:** Run `npm run build` — Expected: sukses; `npx eslint src/app/absen-kiosk` — Expected: tanpa error.
- [ ] **Step 3: Commit** `git add src/app/absen-kiosk/kiosk-client.tsx && git commit -m "style(absen-kiosk): make check-out button red"`
- [ ] **Step 4: Deploy & smoke** — push branch, PR ke `main`, merge, tunggu Workers Builds deploy. Di kiosk: login → Absen Masuk → reload → Masuk disabled, Pulang merah aktif → Absen Pulang → keduanya disabled, tabel berisi dua jam.
