# Absen Kaggo Subdomain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghadirkan `absen.kaggo.app` sebagai aplikasi absensi mandiri: login email+PIN, kamera selfie melingkar, tombol Masuk/Pulang, dan log harian, tanpa mengubah app utama.

**Architecture:** Satu codebase Vercel. Middleware me-rewrite hostname `absen.kaggo.app` ke route internal `/absen-kiosk`. Kiosk memakai sesi cookie httpOnly bertanda tangan (bukan Supabase Auth), dan RPC Postgres baru untuk verifikasi PIN serta tulis absensi ke tabel `attendance_records` yang sudah ada. Data karyawan & PIN diatur dari form `/app/karyawan`.

**Tech Stack:** Next.js 16 App Router, TypeScript, `node:crypto` (HMAC), Supabase Postgres + `pgcrypto`, Tailwind 4, sonner, vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-absen-kaggo-subdomain-design.md`

## Global Constraints

- PIN tepat 6 digit angka; disimpan hanya sebagai bcrypt hash (`pgcrypto.crypt` + `gen_salt('bf')`).
- Sesi kiosk: cookie `kaggo_absen_session`, httpOnly + secure + sameSite=lax + path `/`, maxAge 43200 detik (12 jam).
- `employee_id` untuk absensi selalu berasal dari cookie terverifikasi, tidak pernah dari FormData.
- Satu baris absen per karyawan per hari (WIB) — constraint sudah ada di `attendance_records`.
- GPS opsional; kegagalan geolocation tetap menyimpan absen dengan koordinat `null`.
- Error PIN sengaja generik: "Email atau PIN salah".
- Rate limit: 5 kegagalan per email → kunci 15 menit.
- Host kiosk: `absen.kaggo.app`; app utama tetap `cervise.vercel.app` (tahap 1).
- Env baru: `ABSEN_SESSION_SECRET` (HMAC secret).
- Bahasa UI: Indonesia, kalimat pendek.

## Review Focus

| Input / kondisi | Perilaku yang diharapkan | Test ada di |
| --- | --- | --- |
| Cookie sesi dimodifikasi / payload diubah | `verifySession` menolak (HMAC tidak cocok), bukan membaca employee id palsu | Task 1 |
| Cookie sudah melewati 12 jam | `verifySession` mengembalikan null → form PIN muncul lagi | Task 1 |
| FormData mengirim `employeeId` palsu | RPC memakai id dari cookie | Task 5 |
| PIN salah 5 kali | RPC mengunci 15 menit dan pesannya tidak membocorkan email | Task 2 |
| Host `absen.kaggo.app` vs host lain | Hanya host absen yang di-rewrite ke `/absen-kiosk` | Task 3 |

---

### Task 1: Helper PIN & sesi

**Files:** Create `src/lib/attendance/pin.ts`, `src/lib/attendance/session.ts`; Test `src/lib/attendance/pin.test.ts`, `src/lib/attendance/session.test.ts`

**Interfaces:** Produces `validPin(value: string): boolean`, `signSession(payload: SessionPayload, secret: string): string`, `verifySession(token: string | undefined, secret: string): SessionPayload | null`, tipe `SessionPayload = { employeeId: string; organizationId: string; branchId: string | null; name: string; exp: number }`. Dipakai Task 4 & 5.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// src/lib/attendance/pin.test.ts
import { describe, expect, it } from "vitest";
import { validPin } from "./pin";

describe("validPin", () => {
  it("hanya menerima enam digit", () => {
    expect(validPin("123456")).toBe(true);
    expect(validPin("12345")).toBe(false);
    expect(validPin("1234567")).toBe(false);
    expect(validPin("12a456")).toBe(false);
    expect(validPin(" 123456 ")).toBe(false);
  });
});
```

```ts
// src/lib/attendance/session.test.ts
import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

const SECRET = "rahasia-tes";
const payload = {
  employeeId: "emp-1", organizationId: "org-1", branchId: "b-1",
  name: "Budi", exp: Date.now() + 60_000,
};

describe("session", () => {
  it("mengembalikan payload untuk token yang sah", () => {
    expect(verifySession(signSession(payload, SECRET), SECRET)).toEqual(payload);
  });
  it("menolak token yang dimodifikasi", () => {
    const token = signSession(payload, SECRET);
    const [body, sig] = token.split(".");
    expect(verifySession(`${body}.${sig.slice(0, -1)}x`, SECRET)).toBeNull();
  });
  it("menolak token dengan secret lain", () => {
    expect(verifySession(signSession(payload, SECRET), "secret-lain")).toBeNull();
  });
  it("menolak token kedaluwarsa", () => {
    const expired = { ...payload, exp: Date.now() - 1 };
    expect(verifySession(signSession(expired, SECRET), SECRET)).toBeNull();
  });
  it("menolak token kosong", () => {
    expect(verifySession(undefined, SECRET)).toBeNull();
    expect(verifySession("tidak-ada-titik", SECRET)).toBeNull();
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/lib/attendance` — Expected: FAIL (modul belum ada).
- [ ] **Step 3: Implementasi**

```ts
// src/lib/attendance/pin.ts
const PIN_PATTERN = /^\d{6}$/;

export function validPin(value: string): boolean {
  return PIN_PATTERN.test(value);
}
```

```ts
// src/lib/attendance/session.ts
import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionPayload = {
  employeeId: string;
  organizationId: string;
  branchId: string | null;
  name: string;
  exp: number;
};

function signature(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signature(body, secret)}`;
}

export function verifySession(
  token: string | undefined,
  secret: string,
): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = signature(body, secret);
  const actualBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (
      typeof payload.employeeId !== "string" ||
      typeof payload.organizationId !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp <= Date.now()
    ) return null;
    return payload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4:** Run `npx vitest run src/lib/attendance` — Expected: PASS (8 test).
- [ ] **Step 5: Commit** `git add src/lib/attendance/pin.ts src/lib/attendance/pin.test.ts src/lib/attendance/session.ts src/lib/attendance/session.test.ts && git commit -m "feat(absen-kiosk): add PIN and session helpers"`

---

### Task 2: Migrasi PIN, rate limit, dan RPC tulis

**Files:** Create `supabase/migrations/20261119120000_attendance_pin.sql`; Test `supabase/migrations/attendance-pin.test.ts`

**Interfaces:** Produces RPC `public.set_employee_pin(p_employee_id uuid, p_pin text)` (service_role only), `public.verify_employee_pin(p_email text, p_pin text)` returns `(employee_id uuid, organization_id uuid, branch_id uuid, full_name text)` (service_role only), `public.submit_attendance_pin(p_employee_id uuid, p_kind text, p_selfie_path text, p_lat double precision, p_lng double precision, p_note text)` returns `public.attendance_records` (service_role only). Dipakai Task 4 & 5.

- [ ] **Step 1: Tulis test kontrak migrasi yang gagal**

```ts
// supabase/migrations/attendance-pin.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(`${__dirname}/20261119120000_attendance_pin.sql`, "utf8");

describe("migrasi PIN absen", () => {
  it("menyimpan hash bcrypt, bukan PIN plaintext", () => {
    expect(sql).toContain("gen_salt('bf')");
    expect(sql).toContain("crypt(p_pin, pin_hash)");
  });
  it("mengunci 5 kegagalan selama 15 menit dengan pesan generik", () => {
    expect(sql).toContain("Email atau PIN salah");
    expect(sql).toContain(">= 5");
    expect(sql).toContain("interval '15 minutes'");
  });
  it("hanya service_role yang bisa memanggil RPC", () => {
    expect(sql).toContain("grant execute on function public.verify_employee_pin");
    expect(sql).toContain("to service_role");
  });
});
```

- [ ] **Step 2:** Run `npx vitest run supabase/migrations/attendance-pin.test.ts` — Expected: FAIL.
- [ ] **Step 3: Tulis migrasi**

```sql
-- PIN absen kiosk: hash bcrypt + rate limit + RPC tulis berbasis employee_id terverifikasi.
alter table public.employees
  add column if not exists pin_hash text,
  add column if not exists pin_updated_at timestamptz;

create table if not exists public.attendance_pin_attempts (
  email_key text primary key,
  failures integer not null default 0,
  locked_until timestamptz
);

revoke all on public.attendance_pin_attempts from anon, authenticated;
grant select, insert, update, delete on public.attendance_pin_attempts to service_role;

create or replace function public.set_employee_pin(
  p_employee_id uuid,
  p_pin text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    raise exception 'PIN harus 6 digit angka';
  end if;
  update public.employees
     set pin_hash = crypt(p_pin, gen_salt('bf')),
         pin_updated_at = now()
   where id = p_employee_id;
  if not found then
    raise exception 'Karyawan tidak ditemukan';
  end if;
end;
$$;

create or replace function public.verify_employee_pin(
  p_email text,
  p_pin text
) returns table (
  employee_id uuid,
  organization_id uuid,
  branch_id uuid,
  full_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(coalesce(p_email, '')));
  v_attempt public.attendance_pin_attempts%rowtype;
  v_next_failures integer;
begin
  select * into v_attempt from public.attendance_pin_attempts where email_key = v_key;

  if found and v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    raise exception 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.';
  end if;

  if v_key <> '' and p_pin is not null and exists (
    select 1
    from public.employees e
    join public.profiles p on p.id = e.profile_id
    where lower(trim(p.email)) = v_key
      and e.is_active = true
      and p.is_active = true
      and e.pin_hash is not null
      and crypt(p_pin, e.pin_hash) = e.pin_hash
  ) then
    update public.attendance_pin_attempts
       set failures = 0, locked_until = null
     where email_key = v_key;
    return query
      select e.id, e.organization_id, e.branch_id, p.full_name
      from public.employees e
      join public.profiles p on p.id = e.profile_id
      where lower(trim(p.email)) = v_key
        and e.is_active = true
        and p.is_active = true
        and e.pin_hash is not null
        and crypt(p_pin, e.pin_hash) = e.pin_hash
      limit 1;
    return;
  end if;

  v_next_failures := coalesce(v_attempt.failures, 0) + 1;
  insert into public.attendance_pin_attempts (email_key, failures, locked_until)
  values (v_key, v_next_failures, case when v_next_failures >= 5 then now() + interval '15 minutes' else null end)
  on conflict (email_key) do update
     set failures = case when public.attendance_pin_attempts.locked_until > now()
                         then public.attendance_pin_attempts.failures
                         else v_next_failures end,
         locked_until = case when v_next_failures >= 5
                             then now() + interval '15 minutes' else null end;
  raise exception 'Email atau PIN salah';
end;
$$;

create or replace function public.submit_attendance_pin(
  p_employee_id uuid,
  p_kind text,
  p_selfie_path text,
  p_lat double precision,
  p_lng double precision,
  p_note text
) returns public.attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_date date := (now() at time zone 'Asia/Jakarta')::date;
  v_row public.attendance_records%rowtype;
begin
  if p_kind not in ('check_in', 'check_out') then
    raise exception 'Jenis absen tidak valid';
  end if;
  if p_selfie_path is null or p_selfie_path = '' then
    raise exception 'Foto selfie wajib diisi';
  end if;

  select * into v_employee
  from public.employees
  where id = p_employee_id and is_active = true;
  if not found then
    raise exception 'Karyawan tidak ditemukan';
  end if;
  if v_employee.branch_id is null then
    raise exception 'Cabang karyawan belum ditetapkan';
  end if;

  if p_kind = 'check_in' then
    insert into public.attendance_records (
      organization_id, branch_id, employee_id, attendance_date,
      check_in_at, check_in_selfie_path, check_in_lat, check_in_lng, note
    ) values (
      v_employee.organization_id, v_employee.branch_id, v_employee.profile_id, v_date,
      now(), p_selfie_path, p_lat, p_lng, left(coalesce(p_note, ''), 500)
    )
    on conflict (organization_id, employee_id, attendance_date) do nothing
    returning * into v_row;
    if not found then
      raise exception 'Sudah absen masuk hari ini';
    end if;
  else
    update public.attendance_records
       set check_out_at = now(),
           check_out_selfie_path = p_selfie_path,
           check_out_lat = p_lat,
           check_out_lng = p_lng,
           note = coalesce(nullif(left(coalesce(p_note, ''), 500), ''), note),
           updated_at = now()
     where organization_id = v_employee.organization_id
       and employee_id = v_employee.profile_id
       and attendance_date = v_date
       and check_out_at is null
    returning * into v_row;
    if not found then
      raise exception 'Belum absen masuk atau sudah absen pulang hari ini';
    end if;
  end if;

  return v_row;
end;
$$;

-- Semua RPC dipanggil dari server action memakai service_role.
revoke all on function public.set_employee_pin(uuid, text) from public, anon, authenticated;
revoke all on function public.verify_employee_pin(text, text) from public, anon, authenticated;
revoke all on function public.submit_attendance_pin(uuid, text, text, double precision, double precision, text) from public, anon, authenticated;
grant execute on function public.set_employee_pin(uuid, text) to service_role;
grant execute on function public.verify_employee_pin(text, text) to service_role;
grant execute on function public.submit_attendance_pin(uuid, text, text, double precision, double precision, text) to service_role;
```

- [ ] **Step 4:** Run `npx vitest run supabase/migrations/attendance-pin.test.ts` — Expected: PASS.
- [ ] **Step 5: Terapkan ke Supabase produksi**

Gunakan `tools.supabase.apply_migration({ name: "20261119120000_attendance_pin", query: <isi file SQL di atas> })`. Verifikasi:

Run: `select to_regclass('public.attendance_pin_attempts') as tbl, (select count(*) from information_schema.columns where table_name='employees' and column_name in ('pin_hash','pin_updated_at')) as pin_cols, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('set_employee_pin','verify_employee_pin','submit_attendance_pin')) as rpc_count;`
Expected: `tbl = attendance_pin_attempts`, `pin_cols = 2`, `rpc_count = 3`.

- [ ] **Step 6: Commit** `git add supabase/migrations && git commit -m "feat(absen-kiosk): add PIN RPCs and rate limit"`

---

### Task 3: Host routing & environment

**Files:** Modify `middleware.ts`; Create `src/lib/attendance/host.ts`, `src/lib/attendance/host.test.ts`

**Interfaces:** Produces `isAbsenHost(hostname: string): boolean`. Dipakai middleware.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// src/lib/attendance/host.test.ts
import { describe, expect, it } from "vitest";
import { isAbsenHost } from "./host";

describe("isAbsenHost", () => {
  it("hanya mengenali host absen", () => {
    expect(isAbsenHost("absen.kaggo.app")).toBe(true);
    expect(isAbsenHost("ABSEN.KAGGO.APP")).toBe(true);
    expect(isAbsenHost("kaggo.app")).toBe(false);
    expect(isAbsenHost("cervise.vercel.app")).toBe(false);
    expect(isAbsenHost("absen.kaggo.app.evil.com")).toBe(false);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/lib/attendance/host.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implementasi helper & middleware**

```ts
// src/lib/attendance/host.ts
export const ABSEN_HOST = "absen.kaggo.app";

export function isAbsenHost(hostname: string): boolean {
  return hostname.trim().toLowerCase() === ABSEN_HOST;
}
```

Di `middleware.ts`, tambahkan import dan blok **sebelum** `getProtectedPathKind(pathname)`:

```ts
import { isAbsenHost } from "./src/lib/attendance/host";
```

```ts
  if (isAbsenHost(request.nextUrl.hostname)) {
    return NextResponse.rewrite(new URL("/absen-kiosk", request.url));
  }
```

Catatan: rewrite ini menggantikan response Supabase session refresh untuk host absen (kiosk tidak memakai Supabase Auth), dan sengaja ditempatkan sebelum pengecekan protected path. `export const config.matcher` sudah mengecualikan `_next` dan `api`, jadi aset tidak terkena rewrite.

- [ ] **Step 4: Domain & secret (external)**

1. Di registrar DNS: `CNAME absen.kaggo.app → cname.vercel-dns.com` (pemilik domain).
2. Tambahkan domain ke Vercel: `tools.vercel.add_project_domain({ idOrName: "cervise", requestBody: { name: "absen.kaggo.app" } })`. Catat verification challenge bila `verified: false`, lalu verifikasi.
3. Set env `ABSEN_SESSION_SECRET` di Vercel production (nilai acakminimal 32 karakter).

- [ ] **Step 5:** Run `npx vitest run src/lib/attendance/host.test.ts` — Expected: PASS.
- [ ] **Step 6: Commit** `git add middleware.ts src/lib/attendance/host.ts src/lib/attendance/host.test.ts && git commit -m "feat(absen-kiosk): route absen.kaggo.app host"`

---

### Task 4: Field PIN di form karyawan

**Files:** Modify `src/app/app/karyawan/actions.ts`, `src/components/karyawan/karyawan-form-dialog.tsx`

**Interfaces:** Consumes `validPin` (Task 1), RPC `set_employee_pin` (Task 2). Produces `CreateKaryawanInput.pin?: string`, `UpdateKaryawanInput.pin?: string` (kosong = tidak mengubah PIN).

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/app/app/karyawan/pin-input.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validPin } from "@/lib/attendance/pin";

describe("PIN input karyawan", () => {
  it("menolak PIN bukan 6 digit sebelum dipanggil ke server", () => {
    expect(validPin("000000")).toBe(true);
    expect(validPin("abc123")).toBe(false);
    expect(validPin("")).toBe(false);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/app/app/karyawan/pin-input.test.ts` — Expected: FAIL (modul belum ada).
- [ ] **Step 3: Implementasi action**

Di `src/app/app/karyawan/actions.ts`:

```ts
import { validPin } from "@/lib/attendance/pin";

async function applyPin(employeeId: string, rawPin: string | undefined) {
  if (!rawPin || rawPin.trim() === "") return;
  const pin = rawPin.trim();
  if (!validPin(pin)) throw new Error("PIN harus 6 digit angka");
  const admin = createAdminClient();
  const { error } = await admin.rpc("set_employee_pin", { p_employee_id: employeeId, p_pin: pin });
  if (error) throw new Error(error.message);
}
```

Tambahkan `pin?: string` ke tipe `CreateKaryawanInput` dan `UpdateKaryawanInput`. Di akhir `createKaryawan` sebelum `revalidatePath`: `await applyPin(employee.id as string, input.pin);`. Di akhir `updateKaryawan` sebelum `revalidatePath`: `await applyPin(input.employeeId, input.pin);`.

- [ ] **Step 4: Implementasi form**

Di `src/components/karyawan/karyawan-form-dialog.tsx`: tambah state `pin` (`useState("")`), kosongkan saat dialog dibuka, lalu tambahkan input di dalam grid:

```tsx
<div className="grid gap-1.5">
  <Label>PIN absen (6 digit, opsional)</Label>
  <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
    inputMode="numeric" autoComplete="off" placeholder="Kosongkan untuk tidak mengubah" />
</div>
```

Teruskan `pin` ke `createKaryawan({..., pin})` dan `updateKaryawan({..., pin})`. Tambah validasi klien: `if (pin && !/^\d{6}$/.test(pin)) { toast.error("PIN harus 6 digit angka"); return; }`. PIN tidak pernah ditampilkan saat edit (field selalu kosong).

- [ ] **Step 5:** Run `npx vitest run src/app/app/karyawan/pin-input.test.ts && npm run typecheck` — Expected: PASS (typecheck boleh tetap gagal di file chart baseline; pastikan tidak ada error di file absen/karyawan).
- [ ] **Step 6: Commit** `git add src/app/app/karyawan/actions.ts src/components/karyawan/karyawan-form-dialog.tsx src/app/app/karyawan/pin-input.test.ts && git commit -m "feat(absen-kiosk): let admin set employee PIN"`

---

### Task 5: Login PIN & server action absen

**Files:** Create `src/app/absen-kiosk/actions.ts`, `src/app/absen-kiosk/actions.test.ts`

**Interfaces:** Consumes `validPin` & `signSession`/`verifySession` (Task 1), RPC `verify_employee_pin`/`submit_attendance_pin` (Task 2), `attendancePhotoPath` & `PHOTO_BUCKET` (existing). Produces `loginWithPin(formData: FormData): Promise<void>` (mengarahkan ulang lewat `revalidatePath("/absen-kiosk")`), `submitKioskAttendance(formData: FormData): Promise<{ ok: true }>`, `readSession(): SessionPayload | null`. Dipakai Task 6.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// src/app/absen-kiosk/actions.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, upload, remove, cookiesSet, cookiesGet, revalidatePath, verifySessionMock } =
  vi.hoisted(() => {
    const rpc = vi.fn();
    const upload = vi.fn();
    const remove = vi.fn();
    const cookiesSet = vi.fn();
    const cookiesGet = vi.fn();
    return {
      rpc, upload, remove, cookiesSet, cookiesGet,
      revalidatePath: vi.fn(),
      verifySessionMock: vi.fn(),
    };
  });

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc, storage: { from: () => ({ upload, remove }) } }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookiesSet, get: cookiesGet }) }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/attendance/session", () => ({ verifySession: verifySessionMock, signSession: vi.fn(() => "token") }));
vi.mock("@/lib/attendance/pin", () => ({ validPin: (v: string) => /^\d{6}$/.test(v) }));

import { loginWithPin, submitKioskAttendance } from "./actions";

function loginForm(email = "budi@kaggo.id", pin = "123456") {
  const f = new FormData();
  f.append("email", email);
  f.append("pin", pin);
  return f;
}

function absenForm(kind = "check_in") {
  const f = new FormData();
  f.append("kind", kind);
  f.append("selfie", new File([new Uint8Array(1024)], "selfie.jpg", { type: "image/jpeg" }));
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ABSEN_SESSION_SECRET = "secret-tes";
  rpc.mockResolvedValue({ data: [{ employee_id: "emp-1", organization_id: "org-1", branch_id: "b-1", full_name: "Budi" }], error: null });
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  verifySessionMock.mockReturnValue({ employeeId: "emp-1", organizationId: "org-1", branchId: "b-1", name: "Budi", exp: Date.now() + 1000 });
});

describe("loginWithPin", () => {
  it("menolak PIN bukan 6 digit tanpa memanggil RPC", async () => {
    await expect(loginWithPin(loginForm("budi@kaggo.id", "abc"))).rejects.toThrow("PIN harus 6 digit angka");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("menolak email kosong", async () => {
    await expect(loginWithPin(loginForm("  ", "123456"))).rejects.toThrow("Email wajib");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("membuat cookie httpOnly setelah PIN valid", async () => {
    await loginWithPin(loginForm());
    expect(cookiesSet).toHaveBeenCalledWith("kaggo_absen_session", "token", expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }));
  });
});

describe("submitKioskAttendance", () => {
  it("memakai employee_id dari sesi, bukan dari FormData", async () => {
    const form = absenForm();
    form.append("employeeId", "emp-palsu");
    await submitKioskAttendance(form);
    expect(rpc).toHaveBeenCalledWith("submit_attendance_pin", expect.objectContaining({ p_employee_id: "emp-1" }));
  });
  it("menolak tanpa sesi", async () => {
    verifySessionMock.mockReturnValue(null);
    await expect(submitKioskAttendance(absenForm())).rejects.toThrow("Sesi berakhir");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("menghapus foto yang terunggah saat RPC gagal", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Sudah absen masuk hari ini" } });
    await expect(submitKioskAttendance(absenForm())).rejects.toThrow("Sudah absen masuk hari ini");
    expect(remove).toHaveBeenCalledWith([expect.stringMatching(/^attendance\//)]);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/app/absen-kiosk/actions.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implementasi**

```ts
// src/app/absen-kiosk/actions.ts
"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHOTO_BUCKET, attendancePhotoPath, isSafeObjectPath, validatePhotoFile } from "@/lib/photos";
import { wibDate } from "@/lib/attendance/status";
import { validPin } from "@/lib/attendance/pin";
import { signSession, verifySession, type SessionPayload } from "@/lib/attendance/session";

const COOKIE_NAME = "kaggo_absen_session";
const TWELVE_HOURS = 12 * 60 * 60;

function secret(): string {
  const value = process.env.ABSEN_SESSION_SECRET;
  if (!value) throw new Error("ABSEN_SESSION_SECRET belum dikonfigurasi");
  return value;
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(COOKIE_NAME)?.value, secret());
}

export async function loginWithPin(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pin = String(formData.get("pin") ?? "").trim();
  if (!email) throw new Error("Email wajib");
  if (!validPin(pin)) throw new Error("PIN harus 6 digit angka");

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_employee_pin", { p_email: email, p_pin: pin });
  if (error || !data?.length) throw new Error(error?.message ?? "Email atau PIN salah");

  const row = data[0] as { employee_id: string; organization_id: string; branch_id: string | null; full_name: string | null };
  const token = signSession({
    employeeId: row.employee_id,
    organizationId: row.organization_id,
    branchId: row.branch_id,
    name: row.full_name ?? "Karyawan",
    exp: Date.now() + TWELVE_HOURS * 1000,
  }, secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TWELVE_HOURS,
  });
  revalidatePath("/absen-kiosk");
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function submitKioskAttendance(formData: FormData): Promise<{ ok: true }> {
  const session = await readSession();
  if (!session) throw new Error("Sesi berakhir. Silakan masuk lagi.");

  const kind = formData.get("kind");
  if (kind !== "check_in" && kind !== "check_out") throw new Error("Jenis absen tidak valid");
  const selfie = formData.get("selfie");
  if (!(selfie instanceof File) || selfie.size === 0) throw new Error("Selfie wajib diisi");
  const validation = validatePhotoFile(selfie);
  if (!validation.ok) throw new Error(validation.error);

  const admin = createAdminClient();
  const path = attendancePhotoPath(
    session.organizationId, session.employeeId, wibDate(new Date()),
    kind === "check_in" ? "in" : "out", validation.extension,
  );
  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, selfie, { contentType: selfie.type, upsert: false });
  if (uploadError) throw new Error(`Gagal mengunggah selfie: ${uploadError.message}`);

  const note = formData.get("note");
  const { error } = await admin.rpc("submit_attendance_pin", {
    p_employee_id: session.employeeId,
    p_kind: kind,
    p_selfie_path: path,
    p_lat: numberOrNull(formData.get("lat")),
    p_lng: numberOrNull(formData.get("lng")),
    p_note: typeof note === "string" ? note : null,
  });
  if (error) {
    if (isSafeObjectPath(path)) await admin.storage.from(PHOTO_BUCKET).remove([path]);
    throw new Error(error.message);
  }

  revalidatePath("/absen-kiosk");
  return { ok: true };
}
```

Catatan: test tidak memanggil `readSession` secara langsung; `submitKioskAttendance` memanggilnya.

- [ ] **Step 4:** Run `npx vitest run src/app/absen-kiosk/actions.test.ts` — Expected: PASS (6 test).
- [ ] **Step 5: Commit** `git add src/app/absen-kiosk/actions.ts src/app/absen-kiosk/actions.test.ts && git commit -m "feat(absen-kiosk): add PIN login and attendance actions"`

---

### Task 6: Halaman kiosk (form PIN + kamera + tabel log)

**Files:** Create `src/app/absen-kiosk/page.tsx`, `src/app/absen-kiosk/pin-login.tsx`, `src/app/absen-kiosk/kiosk-client.tsx`, `src/app/absen-kiosk/kiosk-data.ts`

**Interfaces:** Consumes `readSession` (Task 5), `loginWithPin`/`submitKioskAttendance` (Task 5), view `attendance_rekap` (migration absensi sebelumnya).

- [ ] **Step 1: Server page & query log**

```tsx
// src/app/absen-kiosk/page.tsx
import { createAdminClient } from "@/lib/supabase/admin";
import { wibDate } from "@/lib/attendance/status";
import { readSession } from "./actions";
import { PinLogin } from "./pin-login";
import { KioskClient } from "./kiosk-client";
import { toLogRow, type LogRow } from "./kiosk-data";

export const dynamic = "force-dynamic";

export default async function AbsenKioskPage() {
  const session = await readSession();
  if (!session) return <PinLogin />;

  const today = wibDate(new Date());
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attendance_rekap")
    .select("attendance_date, check_in_at, check_out_at, check_in_time, check_out_time")
    .eq("employee_id", session.employeeId)
    .order("attendance_date", { ascending: false })
    .limit(7);
  if (error) throw new Error(error.message);

  const rawRows = (data ?? []) as Parameters<typeof toLogRow>[0][];
  const rows: LogRow[] = rawRows.map((row) => toLogRow(row));
  return <KioskClient name={session.name} today={today} rows={rows} />;
}
```

Helper `toLogRow` dipakai supaya tidak ada `any` baru:

```ts
// src/app/absen-kiosk/kiosk-data.ts
import { attendanceStatus, ATTENDANCE_STATUS_LABEL, type AttendanceStatus } from "@/lib/attendance/status";

export type LogRow = {
  tanggal: string; jamMasuk: string | null; jamPulang: string | null;
  checkInTime: string; checkOutTime: string;
};

export function toLogRow(r: {
  attendance_date: string; check_in_at: string | null; check_out_at: string | null;
  check_in_time: string; check_out_time: string;
}): LogRow {
  return {
    tanggal: r.attendance_date, jamMasuk: r.check_in_at, jamPulang: r.check_out_at,
    checkInTime: r.check_in_time, checkOutTime: r.check_out_time,
  };
}

export function logStatus(row: LogRow): AttendanceStatus {
  return attendanceStatus({
    checkInAt: row.jamMasuk, checkOutAt: row.jamPulang,
    checkInTime: row.checkInTime, checkOutTime: row.checkOutTime,
  });
}

export const logStatusLabel = (status: AttendanceStatus) => ATTENDANCE_STATUS_LABEL[status];

export const jam = (value: string | null) =>
  value ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "-";
```

- [ ] **Step 2: Form PIN**

```tsx
// src/app/absen-kiosk/pin-login.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginWithPin } from "./actions";

export function PinLogin() {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-5 px-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Kaggo · Absensi</p>
        <h1 className="font-heading text-2xl font-semibold">Masuk absensi</h1>
        <p className="text-sm text-muted-foreground">Gunakan email & PIN 6 digit yang diberikan admin.</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const form = new FormData();
            form.append("email", email);
            form.append("pin", pin);
            try {
              await loginWithPin(form);
              window.location.reload();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Gagal masuk");
            }
          });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pin">PIN</Label>
          <Input id="pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} required />
        </div>
        <Button className="w-full" disabled={pending} type="submit">{pending ? "Memeriksa..." : "Masuk"}</Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Kiosk client**

```tsx
// src/app/absen-kiosk/kiosk-client.tsx
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { submitKioskAttendance } from "./actions";
import { jam, logStatus, logStatusLabel, type LogRow } from "./kiosk-data";

export function KioskClient({ name, today, rows }: { name: string; today: string; rows: LogRow[] }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lokasi, setLokasi] = useState<{ lat: number; lng: number } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setCameraError("Kamera tidak tersedia. Izinkan akses kamera di browser."));
    return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  async function capture(): Promise<File | null> {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(
      video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, 640, 640,
    );
    return new Promise<File | null>((resolve) =>
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], "selfie.jpg", { type: "image/jpeg" }) : null),
        "image/jpeg", 0.85,
      ),
    );
  }

  function mintaLokasi(cb: (koordinat: { lat: number; lng: number } | null) => void) {
    if (!navigator.geolocation) { cb(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const koordinat = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLokasi(koordinat);
        cb(koordinat);
      },
      () => { toast.info("Lokasi tidak tersedia. Absen tetap disimpan."); cb(lokasi); },
      { timeout: 8000 },
    );
  }

  function absen(kind: "check_in" | "check_out") {
    void capture().then((file) => {
      if (!file) { toast.error("Selfie belum siap. Coba lagi."); return; }
      mintaLokasi((koordinat) => startTransition(async () => {
        const form = new FormData();
        form.append("kind", kind);
        form.append("selfie", file);
        if (koordinat) { form.append("lat", String(koordinat.lat)); form.append("lng", String(koordinat.lng)); }
        try {
          await submitKioskAttendance(form);
          toast.success(kind === "check_in" ? "Absen masuk tercatat" : "Absen pulang tercatat");
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Gagal menyimpan absen");
        }
      }));
    });
  }

  const todayRow = rows.find((r) => r.tanggal === today);
  const sudahMasuk = !!todayRow?.jamMasuk;
  const sudahPulang = !!todayRow?.jamPulang;

  return (
    <main className="mx-auto max-w-md space-y-6 px-5 py-8">
      <header className="text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Kaggo · Absensi</p>
        <h1 className="font-heading text-xl font-semibold">Halo, {name}</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </header>

      <div className="mx-auto aspect-square w-64 overflow-hidden rounded-full border-4 border-background bg-muted shadow-lg">
        <video ref={videoRef} autoPlay playsInline muted aria-label="Preview kamera selfie" className="h-full w-full object-cover" />
      </div>
      {cameraError ? <p className="text-center text-sm text-destructive">{cameraError}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        <Button disabled={pending || sudahMasuk} onClick={() => absen("check_in")}>Absen Masuk</Button>
        <Button disabled={pending || !sudahMasuk || sudahPulang} onClick={() => absen("check_out")}>Absen Pulang</Button>
      </div>
      {sudahPulang ? <p className="text-center text-sm text-muted-foreground">Absen hari ini selesai.</p> : null}

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold">Log harian</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>{["Tanggal", "Masuk", "Pulang", "Status"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = logStatus(row);
                return (
                  <tr key={row.tanggal} className="border-t">
                    <td className="px-3 py-2">{row.tanggal}</td>
                    <td className="px-3 py-2">{jam(row.jamMasuk)}</td>
                    <td className="px-3 py-2">{jam(row.jamPulang)}</td>
                    <td className="px-3 py-2">{logStatusLabel(status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Verifikasi**

Run: `npx eslint src/app/absen-kiosk && npm run typecheck`
Expected: tidak ada error di `src/app/absen-kiosk` (error baseline di `src/components/charts/*` diabaikan).

Manual: buka `/absen-kiosk` di dev dengan host palsu belum bisa di-rewrite; untuk verifikasi UI sementara, buka langsung `/absen-kiosk` dan pastikan form PIN muncul.

- [ ] **Step 5: Commit** `git add src/app/absen-kiosk && git commit -m "feat(absen-kiosk): add PIN form, circular camera and daily log"`

---

### Task 7: Verifikasi akhir & deployment

- [ ] **Step 1:** Run `npm run test && npm run typecheck && npm run lint && npm run build`.
  Expected: test absen-kiosk lulus; 1 test baseline `lacak-appearance-css` tetap gagal; typecheck/lint/build hanya gagal pada file baseline (`src/components/charts/*`, dsb.), bukan file kiosk.
- [ ] **Step 2: Cek DNS & domain**

Run: `curl.exe -I https://absen.kaggo.app/` — Expected: 200 atau 307 ke halaman kiosk (bukan NXDOMAIN). Verifikasi di Vercel bahwa `absen.kaggo.app` berstatus `verified: true`.

- [ ] **Step 3: Smoke test produksi**

1. Admin buka `/app/karyawan`, set PIN 6 digit untuk satu karyawan uji.
2. Karyawan buka `https://absen.kaggo.app/` → form Email+PIN.
3. Masuk → preview melingkar muncul → tekan **Absen Masuk** → baris hari ini muncul di tabel dengan jam.
4. Tekan **Absen Pulang** → kolom Pulang terisi, status berubah.
5. Tutup browser, buka lagi → masih masuk (cookie 12 jam). Set 12 jam/hapus cookie → form PIN muncul lagi.

- [ ] **Step 4: Commit perbaikan bila ada** `git add -A && git commit -m "fix(absen-kiosk): address verification findings"`
