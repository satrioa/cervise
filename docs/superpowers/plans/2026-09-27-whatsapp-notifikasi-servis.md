# Notifikasi WhatsApp Servis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kirim pesan WhatsApp ke customer dan teknisi saat servis dibuat, plus ke customer saat status mencapai `Selesai` atau `Sudah Diambil`, dengan outbox database dan retry cron sehingga pembuatan servis tidak pernah gagal karena WhatsApp.

**Architecture:** Trigger database hanya menulis metadata event ke tabel outbox, tanpa isi pesan, karena URL halaman lacak membutuhkan origin aplikasi yang tidak diketahui database. Cron di aplikasi yang mengklaim baris yang due lewat RPC dengan `for update skip locked`, me-resolve penerima, merender teks, lalu mengirim lewat Fonnte, dengan backoff dan state per baris.

**Tech Stack:** Next.js (App Router, Server Actions), Supabase (Postgres, RLS, RPC, trigger), Fonnte WhatsApp API, Vitest, Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-09-27-whatsapp-notifikasi-servis-design.md`

## Global Constraints

- Satu nomor Fonnte milik platform, dibaca dari env `FONNTE_TOKEN`. Tidak ada token per tenant.
- Isi pesan **teks saja**. Tidak ada PDF, dokumen, atau lampiran apa pun.
- Nomor telepon disimpan dalam bentuk kanonik `62...`. Sumber tunggal adalah `profiles.phone`. **Jangan menambah kolom `employees.phone`.**
- Outbox: RLS aktif, **tanpa policy**, `revoke all` dari `anon` dan `authenticated`, `grant` ke `service_role`.
- `servis_id` di outbox **tanpa foreign key**, supaya menghapus servis tidak menghapus riwayat pengiriman.
- Tidak ada fallback fiktif di pesan. Field kosong berarti baris dihilangkan, bukan dirender sebagai `undefined` atau `"-"` karangan.
- Nama toko selalu ada di setiap pesan, karena pengirim adalah nomor platform, bukan nomor toko.
- Dedupe: `servis:<id>:<event>[:<to_status>]:<to_kind>`, dengan `on conflict (dedupe_key) do nothing`.
- Setelah setiap `apply_migration`, versi di `supabase_migrations.schema_migrations` harus di-update ke versi nama file, karena `apply_migration` mencatat versi timestamp.
- Nomori migrasi: `20260925210000_profile_phone_validation`, lalu `20260925220000_service_notification_outbox`.
- Bahasa comment dan pesan mengikuti repo: Indonesia.

## Review Focus

Lima kelas input berikut tidak diuji eksplisit oleh spec, tapi paling mungkin menyakitkan orang yang memakai sistem ini. Masing-masing dipatok oleh test di task yang memiliki kodenya.

1. **Nomor teknisi diperbaiki setelah pesan masuk antrean** — kalau nomor disalin saat enqueue, koreksi admin tidak akan pernah terpakai. Dispatcher harus membaca nomor saat dispatch.
2. **Teknisi sudah dinonaktifkan** — `cervise_services.teknisi_id` masih menunjuk dia, `profiles.phone` masih terisi, tapi dia sudah tidak lagi becoming teknisi. Pesan tidak boleh terkirim.
3. **Nomor tidak bisa dikirim** — `null`, kosong, `"0812"`, atau string yang lolos validasi UI tapi ditolak Fonnte. Harus `skipped` supaya tidak retry sia-sia selama 4 percobaan.
4. **Rework** — servis `Selesai` → `Dikerjakan` → `Selesai` lagi. Pelanggan tidak boleh menerima "Selesai" dua kali.
5. **Servis dihapus** — `servis_id` tidak punya FK, jadi dispatcher harus menangani baris yang menunjuk servis yang sudah hilang.

## File Structure

| File | Tanggung jawab |
|---|---|
| `src/lib/fonnte.ts` | Klien Fonnte. Membedakan gagal dan sukses meski HTTP 200. |
| `src/lib/phone.ts` | Normalisasi, validasi, dan bentuk target Fonnte untuk nomor telepon. |
| `supabase/migrations/20260925210000_profile_phone_validation.sql` | CHECK constraint format nomor. |
| `src/lib/auth/profile-phone-migration.test.ts` | Penjaga statis migration A. |
| `src/app/app/karyawan/actions.ts` | Validasi server-side: nomor wajib untuk teknisi. |
| `src/components/karyawan/karyawan-form-dialog.tsx` | Validasi client-side + atribut input telepon. |
| `src/components/karyawan/karyawan-list.tsx` | Kolom telepon + badge "belum ada nomor". |
| `src/components/karyawan/export-karyawan-csv.tsx` | Kolom Telepon di CSV. |
| `src/app/app/servis/actions.ts` | Hanya `getTeknisi()`. |
| `src/lib/notifications/service-message.ts` | Membangun teks pesan. Murni, tanpa I/O. |
| `src/lib/notifications/dispatcher.ts` | Resolve penerima, kirim, kelola state dan retry. |
| `src/app/api/cron/service-notifications/route.ts` | Endpoint cron. |
| `supabase/migrations/20260925220000_service_notification_outbox.sql` | Tabel outbox, trigger, RPC suppressor. |
| `src/lib/auth/notification-outbox-migration.test.ts` | Penjaga statis migration B. |
| `scripts/seed-demo-data.mjs` | Memperriktifkan trigger saat seed. |

Tidak ada perubahan pada `src/app/app/servis/actions.ts` selain `getTeknisi()`. `createServis` tidak disentuh sama sekali — trigger menutup semua jalur.

---

### Task 1: Klien Fonnte membedakan gagal dari sukses

`src/lib/fonnte.ts` sekarang hanya mengecek `res.ok`. Fonnte membalas HTTP 200 dengan `{ "status": false, "reason": "insufficient quota" }`, jadi kehabisan kuota dilaporkan sukses dan tidak akan pernah di-retry.

**Files:**
- Modify: `src/lib/fonnte.ts`
- Test: `src/lib/fonnte.test.ts`

**Interfaces:**
- Consumes: `process.env.FONNTE_TOKEN`
- Produces:
  - `class FonnteError extends Error` dengan field `readonly reason: string` dan `readonly retryable: boolean`
  - `type FonnteSendResult = { skip: true } | { skip: false; status: true; detail: Record<string, unknown> }`
  - `sendFonnteWA(phone: string, message: string, countryCode?: string): Promise<FonnteSendResult>`

- [ ] **Step 1: Tambahkan test untuk kegagalan yang tersembunyi**

Tambahkan dua test baru di `src/lib/fonnte.test.ts`, di dalam `describe("sendFonnteWA")`:

```ts
  it("treats HTTP 200 with status false as a failure", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ status: false, reason: "insufficient quota" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const error = await sendFonnteWA("6281234567890", "Halo").catch(
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(FonnteError);
    expect((error as FonnteError).reason).toBe("insufficient quota");
    expect((error as FonnteError).retryable).toBe(true);
  });

  it("marks an invalid target as not retryable", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ status: false, reason: "invalid target" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const error = await sendFonnteWA("0812", "Halo").catch(
      (err: unknown) => err,
    );
    expect((error as FonnteError).reason).toBe("invalid target");
    expect((error as FonnteError).retryable).toBe(false);
  });

  it("marks a rejected token as not retryable", async () => {
    // Token Fonnte dipakai bersama semua tenant, jadi token kedaluwarsa
    // menghentikan SEMUA pesan. Mengulangnya hanya membuang kuota.
    process.env.FONNTE_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 401 })),
    );

    const error = await sendFonnteWA("628123456789", "Halo").catch(
      (err: unknown) => err,
    );
    expect((error as FonnteError).reason).toBe("HTTP 401");
    expect((error as FonnteError).retryable).toBe(false);
  });

  it("keeps server errors and rate limits retryable", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 503 })),
    );
    expect(
      await sendFonnteWA("628123456789", "Halo").catch((e: unknown) => e),
    ).toMatchObject({ retryable: true });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 429 })),
    );
    expect(
      await sendFonnteWA("628123456789", "Halo").catch((e: unknown) => e),
    ).toMatchObject({ retryable: true });
  });

  it("sends the country code when one is given", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendFonnteWA("6281234567890", "Halo", "62");

    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as URLSearchParams;
    expect(body.get("countryCode")).toBe("62");
  });
});
```

Ubah juga import di baris pertama file dari:

```ts
import { sendFonnteWA } from "./fonnte";
```

menjadi:

```ts
import { FonnteError, sendFonnteWA } from "./fonnte";
```

- [ ] **Step 2: Jalankan test, harus gagal**

Run: `npm test -- src/lib/fonnte.test.ts`
Expected: FAIL — `FonnteError is not defined`, karena kelasnya belum ada.

- [ ] **Step 3: Tulis ulang `src/lib/fonnte.ts`**

Ganti seluruh isi file:

```ts
// Integrasi WhatsApp via Fonnte - fetch ringan, tanpa dependency.
//
// Fonnte membalas HTTP 200 dengan body { "status": false } saat kehabisan
// kuota atau target tidak valid. Hanya mengecek res.ok akan melaporkan
// kegagalan itu sebagai sukses, jadi body harus diperiksa juga.

export type FonnteSendResult =
  | { skip: true }
  | { skip: false; status: true; detail: Record<string, unknown> };

export class FonnteError extends Error {
  readonly reason: string;
  readonly retryable: boolean;

  constructor(reason: string, retryable: boolean) {
    super(`Fonnte gagal: ${reason}`);
    this.name = "FonnteError";
    this.reason = reason;
    this.retryable = retryable;
  }
}

// Alasan yang tidak akan berubah kalau dikirim ulang: nomor tidak valid,
// parameter salah, token ditolak. Selain daftar ini, apa pun dianggap
// sementara: kehabisan kuota, jaringan, HTTP 5xx, 429.
const PERMANENT_REASONS = [
  "invalid target",
  "invalid parameter",
  "invalid country code",
  "token invalid",
  "token expired",
  "unauthorized",
  "forbidden",
];

function isPermanentReason(reason: string): boolean {
  const normalized = reason.trim().toLowerCase();
  return PERMANENT_REASONS.some((candidate) => normalized.includes(candidate));
}

// Tanpa alasan dari body, kode HTTP yang jadi penentu. 429 dan 5xx pasti
// sementara. 4xx lainnya permanen: token salah atau permintaan tidak valid
// tidak akan berubah kalau dikirim ulang.
function isPermanentStatus(status: number): boolean {
  if (status >= 500) return false;
  if (status === 429) return false;
  return status >= 400;
}

export async function sendFonnteWA(
  phone: string,
  message: string,
  countryCode?: string,
): Promise<FonnteSendResult> {
  const token = process.env.FONNTE_TOKEN;
  if (!token) return { skip: true };

  const body = new URLSearchParams({ target: phone, message });
  if (countryCode) body.set("countryCode", countryCode);

  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: token,
    },
    body,
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (!res.ok || payload.status === false) {
    const bodyReason =
      typeof payload.reason === "string" && payload.reason ? payload.reason : null;
    const reason = bodyReason ?? `HTTP ${res.status}`;
    const permanent = bodyReason
      ? isPermanentReason(bodyReason)
      : isPermanentStatus(res.status);
    throw new FonnteError(reason, !permanent);
  }

  return { skip: false, status: true, detail: payload };
}
```

Hapus juga `servisStatusMessage` yang ada di file itu. Fungsinya tidak pernah dipanggil, dan teksnya menghardcode "Garansi 3 bulan" yang bertentangan dengan `garansi_value` di database. Task 6 menggantikannya dengan builder yang benar.

- [ ] **Step 4: Perbarui dua test lama yang sekarang tidak cocok dengan kontrak baru**

Di `src/lib/fonnte.test.ts`, ganti test "sends the target and message as form data":

```ts
  it("sends the target and message as form data", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendFonnteWA("6281234567890", "Halo Kak"),
    ).resolves.toEqual({
      skip: false,
      status: true,
      detail: { status: true },
    });
```

Dan ganti test "throws when Fonnte rejects the request":

```ts
  it("throws when Fonnte returns a non-2xx response", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: false }), { status: 500 }),
      ),
    );

    await expect(sendFonnteWA("6281234567890", "Halo")).rejects.toThrow(
      "Fonnte gagal: HTTP 500",
    );
  });
```

- [ ] **Step 5: Jalankan test, harus lulus**

Run: `npm test -- src/lib/fonnte.test.ts`
Expected: PASS — 8 test.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fonnte.ts src/lib/fonnte.test.ts
git commit -m "fix: fonnte reports HTTP 200 with status false as a failure"
```

---

### Task 2: Helper nomor telepon bersama

Aturan format sudah ada di repo tapi tidak bisa dipakai ulang: `src/lib/auth/account-input.ts:92-98` hanya terpakai di satu dari empat penulis nomor, dan normalisasi `0` ke `62` di `src/app/onboarding/actions.ts:9-14` hanya dipakai untuk nomor cabang. Task 4 dan Task 8 keduanya butuh ini.

**Files:**
- Create: `src/lib/phone.ts`
- Test: `src/lib/phone.test.ts`
- Modify: `src/app/onboarding/actions.ts`

**Interfaces:**
- Produces:
  - `normalizePhone62(raw: string | null | undefined): string | null` — bentuk kanonik `62...`, atau `null` kalau tidak bisa dipakai
  - `validatePhone(raw: string | null | undefined): { ok: true; value: string | null } | { ok: false; error: string }`
  - `toFonnteTarget(raw: string | null | undefined): string | null` — selalu diawali `62`, atau `null`

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/phone.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizePhone62, toFonnteTarget, validatePhone } from "./phone";

describe("normalizePhone62", () => {
  it("menggabungkan awalan 0, 8, 62, dan +62 ke satu bentuk", () => {
    expect(normalizePhone62("081234567890")).toBe("6281234567890");
    expect(normalizePhone62("81234567890")).toBe("6281234567890");
    expect(normalizePhone62("6281234567890")).toBe("6281234567890");
    expect(normalizePhone62("+62 812-3456-7890")).toBe("6281234567890");
  });

  it("menolak nomor yang tidak masuk akal", () => {
    expect(normalizePhone62("0812")).toBeNull();
    expect(normalizePhone62("")).toBeNull();
    expect(normalizePhone62(null)).toBeNull();
    expect(normalizePhone62(undefined)).toBeNull();
    expect(normalizePhone62("+1 202 555 0147")).toBeNull();
  });
});

describe("validatePhone", () => {
  it("menganggap kosong sebagai tidak diisi, bukan error", () => {
    expect(validatePhone("")).toEqual({ ok: true, value: null });
    expect(validatePhone("   ")).toEqual({ ok: true, value: null });
    expect(validatePhone(null)).toEqual({ ok: true, value: null });
  });

  it("mengembalikan bentuk kanonik untuk nomor yang valid", () => {
    expect(validatePhone(" 0812 3456 7890 ")).toEqual({
      ok: true,
      value: "6281234567890",
    });
  });

  it("menolak karakter yang bukan bagian dari nomor", () => {
    const result = validatePhone("<script>x</script>");
    expect(result.ok).toBe(false);
  });

  it("menolak nomor yang terlalu panjang", () => {
    expect(validatePhone("+62 812 3456 7890 1234 5678").ok).toBe(false);
  });
});

describe("toFonnteTarget", () => {
  it("hanya menerima hasil yang diawali 62", () => {
    expect(toFonnteTarget("081234567890")).toBe("6281234567890");
    expect(toFonnteTarget("12025550147")).toBeNull();
    expect(toFonnteTarget(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan test, harus gagal**

Run: `npm test -- src/lib/phone.test.ts`
Expected: FAIL — tidak bisa resolve `./phone`.

- [ ] **Step 3: Tulis `src/lib/phone.ts`**

```ts
// Aturan nomor telepon yang dipakai bersama: form karyawan, edit profil,
// dan pengiriman WhatsApp. Sempat terduplikasi di onboarding (normalisasi)
// dan account-input (validasi), sekarang hanya di sini.

/**
 * Mengubah apa pun yang diketik orang menjadi bentuk kanonik `62...`.
 * Mengembalikan null kalau nomornya tidak masuk akal, supaya pemanggil
 * bisa membedakan "tidak diisi" dari "diisi dengan tidak valid".
 */
export function normalizePhone62(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;

  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  else if (digits.startsWith("62")) {
    // sudah kanonik
  } else {
    return null;
  }

  // 62 + 7..12 digit subscriber. Di luar itu nomor domestic yang salah ketik.
  if (digits.length < 9 || digits.length > 14) return null;
  return digits;
}

export type PhoneValidation =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/**
 * Validasi untuk form. Kosong itu sah, karena tidak semua role butuh nomor.
 * Aturan panjang dan karakter ikut migration `profiles_phone_charset`, supaya
 * penolakan di aplikasi dan di database tidak berbedaiability.
 */
export function validatePhone(raw: string | null | undefined): PhoneValidation {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return { ok: true, value: null };

  if (trimmed.length > 24) {
    return { ok: false, error: "Nomor telepon terlalu panjang." };
  }

  if (!/^[0-9+\-\s()]+$/.test(trimmed)) {
    return {
      ok: false,
      error: "Nomor telepon hanya boleh berisi angka, spasi, dan + - ( ) .",
    };
  }

  const normalized = normalizePhone62(trimmed);
  if (!normalized) {
    return {
      ok: false,
      error: "Nomor telepon harus diawali 08 atau 62, contoh 081234567890.",
    };
  }

  return { ok: true, value: normalized };
}

/**
 * Bentuk yang dikirim ke Fonnte. Lebih ketat dari `normalizePhone62` karena
 * nomor yang tidak diawali 62 tidak akan sampai ke nomor Indonesia.
 */
export function toFonnteTarget(raw: string | null | undefined): string | null {
  const normalized = normalizePhone62(raw);
  if (!normalized || !normalized.startsWith("62")) return null;
  return normalized;
}
```

- [ ] **Step 4: Jalankan test, harus lulus**

Run: `npm test -- src/lib/phone.test.ts`
Expected: PASS — 9 test.

- [ ] **Step 5: Pakai helper ini di onboarding, hapus duplikatnya**

Di `src/app/onboarding/actions.ts` ada tepat satu pemanggilan, di baris 50. Hapus fungsi `normalizePhone` lokal:

```ts
function normalizePhone(value: string) {
  let digits = value.trim().replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}
```

Tambahkan import di bagian atas file:

```ts
import { normalizePhone62 } from "@/lib/phone";
```

Lalu ganti baris 50:

```ts
  const phone = normalizePhone(opts.telepon ?? "");
```

menjadi:

```ts
  const phone = normalizePhone62(opts.telepon) ?? "";
```

`?? ""` wajib: `normalizePhone` lama selalu mengembalikan string, sedangkan `normalizePhone62` mengembalikan `null` untuk input yang tidak masuk akal. Nilai lama untuk `"0812"` adalah `"62"`, sedangkan yang baru `null`; di sini keduanya tidak dipakai sebagai nomor telepon yang valid, jadi perilakunya tidak berubah.

- [ ] **Step 6: Pastikan typecheck dan test hijau**

Run: `npm run typecheck && npm test -- src/lib/phone.test.ts`
Expected: typecheck bersih, 8 test PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/phone.ts src/lib/phone.test.ts src/app/onboarding/actions.ts
git commit -m "refactor: single source for phone normalization and validation"
```

---

### Task 3: Validasi nomor di level database

Validasi di server action bisa dilewati `PATCH /rest/v1/profiles` langsung, karena grant self-service tetap mengizinkan update kolom `phone`. Jadi aturan format ditegakkan di database.

Kondisi live sudah dicek: **0 baris** `profiles.phone` terisi, jadi constraint bisa langsung divalidasi tanpa `NOT VALID`.

**Files:**
- Create: `supabase/migrations/20260925210000_profile_phone_validation.sql`
- Test: `src/lib/auth/profile-phone-migration.test.ts`

**Interfaces:**
- Produces: constraint `profiles_phone_charset` pada `public.profiles`

- [ ] **Step 1: Tulis test penjaga yang gagal**

Buat `src/lib/auth/profile-phone-migration.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260925210000_profile_phone_validation.sql",
  ),
  "utf8",
);

const flat = sql.replace(/\s+/g, " ").toLowerCase();

describe("profile phone validation migration", () => {
  it("menegakkan format nomor di database", () => {
    expect(flat).toContain("add constraint profiles_phone_charset");
    expect(flat).toContain("length(phone) <= 24");
    expect(flat).toContain("phone ~ '^[0-9+\\-\\s()]+$'");
  });

  it("membiarkan nomor kosong tetap sah", () => {
    expect(flat).toContain("phone is null or");
  });

  it("tidak menambah kolom nomor ke employees", () => {
    expect(flat).not.toContain("alter table public.employees");
  });

  it("tidak mengubah grant self-service", () => {
    expect(flat).not.toContain("grant");
    expect(flat).not.toContain("revoke");
  });

  it("tidak menyentuh tabel lain", () => {
    expect(flat).not.toContain("create policy");
    expect(flat).not.toContain("drop policy");
    expect(flat).not.toContain("create table");
  });
});
```

- [ ] **Step 2: Jalankan test, harus gagal**

Run: `npm test -- src/lib/auth/profile-phone-migration.test.ts`
Expected: FAIL — `ENOENT`, file migration belum ada.

- [ ] **Step 3: Tulis migration**

Buat `supabase/migrations/20260925210000_profile_phone_validation.sql`:

```sql
-- Validasi nomor telepon di level database.
--
-- profiles.phone sudah ada dan bisa diubah sendiri oleh pemiliknya lewat grant
-- self-service, jadi validasi di server action saja bisa dilewati lewat
-- PATCH /rest/v1/profiles. Aturan yang sama dengan validatePhone() di
-- src/lib/phone.ts, kecuali batas panjang: di database ini hanya dibatasi
-- supaya tidak ada bebas simpan string panjang di kolom ini.
--
-- Grant self-service tidak diubah di sini. Yang hilang adalah validasi, bukan
-- akses, dan grant itu dikunci oleh src/lib/auth/security-migration.test.ts.

alter table public.profiles
  add constraint profiles_phone_charset
  check (phone is null or (length(phone) <= 24 and phone ~ '^[0-9+\-\s()]+$'));
```

- [ ] **Step 4: Jalankan test, harus lulus**

Run: `npm test -- src/lib/auth/profile-phone-migration.test.ts`
Expected: PASS — 5 test.

- [ ] **Step 5: Apply migration, lalu selaraskan versinya**

Apply lewat MCP Supabase dengan nama `profile_phone_validation` dan isi file di atas. `apply_migration` akan mencatat versi timestamp, jadi setelah itu jalankan:

```sql
update supabase_migrations.schema_migrations
   set version = '20260925210000'
 where name = 'profile_phone_validation'
   and version <> '20260925210000';
```

Lalu verifikasi:

```sql
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conname = 'profiles_phone_charset';
```

Expected: satu baris, definisi memuat `length(phone) <= 24`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260925210000_profile_phone_validation.sql src/lib/auth/profile-phone-migration.test.ts
git commit -m "feat: enforce phone format on profiles in the database"
```

---

### Task 4: Nomor wajib untuk teknisi, dan terlihat di UI

Hari ini kolom Telepon sudah ada di form (`src/components/karyawan/karyawan-form-dialog.tsx:83`) dan sudah ditulis ke `profiles.phone`, tapi tidak ada validasi sama sekali, tidak wajib, dan tidak pernah terlihat di daftar karyawan karena disembunyikan di balik fallback `email ?? phone` (`src/components/karyawan/karyawan-list.tsx:133`).

Nomor teknisi adalah satu-satunya bahan untuk notifikasi ke teknisi, jadi di task ini dibuat wajib untuk role `TECHNICIAN` dan terlihat oleh admin.

**Files:**
- Modify: `src/app/app/karyawan/actions.ts`
- Modify: `src/components/karyawan/karyawan-form-dialog.tsx`
- Modify: `src/components/karyawan/karyawan-list.tsx`
- Modify: `src/components/karyawan/export-karyawan-csv.tsx`
- Modify: `src/app/app/pengaturan/profil/actions.ts`
- Test: `src/lib/auth/phone-required-actions.test.ts`

**Interfaces:**
- Consumes: `validatePhone`, `PhoneValidation` dari `src/lib/phone.ts` (Task 2)
- Produces: `createKaryawan` dan `updateKaryawan` menolak role `TECHNICIAN` tanpa nomor; nomor tersimpan kanonik

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/auth/phone-required-actions.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src", "app", "app", "karyawan", "actions.ts"),
  "utf8",
);

describe("validasi nomor karyawan", () => {
  it("memakai helper bersama, bukan aturan sendiri", () => {
    expect(source).toContain("validatePhone");
  });

  it("menyimpan nomor dalam bentuk kanonik", () => {
    // expression lama menyimpan input apa adanya: phone: input.phone?.trim() || null
    expect(source).not.toContain("phone: input.phone?.trim() || null");
  });

  it("menuntut nomor saat role teknisi", () => {
    expect(source).toContain("TEKNI");
  });
});
```

- [ ] **Step 2: Jalankan test, harus gagal**

Run: `npm test -- src/lib/auth/phone-required-actions.test.ts`
Expected: FAIL — `validatePhone` belum ada di file.

- [ ] **Step 3: Validasi di `createKaryawan`**

Di `src/app/app/karyawan/actions.ts`, tambahkan import di bagian atas:

```ts
import { validatePhone } from "@/lib/phone";
```

Di `createKaryawan`, tepat setelah baris `if (!email || !email.includes("@")) throw new Error("Email tidak valid");`, tambahkan:

```ts
  const phoneCheck = validatePhone(input.phone);
  if (!phoneCheck.ok) throw new Error(phoneCheck.error);
  if (targetRole === "TECHNICIAN" && !phoneCheck.value) {
    throw new Error("Nomor WhatsApp wajib diisi untuk teknisi.");
  }
```

Lalu ganti penulisan nomor di `profilePatch`, dari:

```ts
      phone: input.phone?.trim() || null,
```

menjadi:

```ts
      phone: phoneCheck.value,
```

- [ ] **Step 4: Validasi juga di `updateKaryawan`**

Di `updateKaryawan`, setelah baris validasi email, tambahkan:

```ts
  const phoneCheck = validatePhone(input.phone);
  if (!phoneCheck.ok) throw new Error(phoneCheck.error);
  if (targetRole === "TECHNICIAN" && !phoneCheck.value) {
    throw new Error("Nomor WhatsApp wajib diisi untuk teknisi.");
  }
```

Lalu ganti `phone: input.phone?.trim() || null,` di dalam `profilePatch` menjadi:

```ts
    phone: phoneCheck.value,
```

Perhatikan indentasi: `profilePatch` di `updateKaryawan` berada satu level di dalam blok, jadi sesuaikan.

- [ ] **Step 5: Validasi di edit profil mandiri**

Di `src/app/app/pengaturan/profil/actions.ts`, cari baris yang menyimpan nomor:

```ts
  const phone = data.phone.trim() || null;
```

Ganti dengan:

```ts
  const phoneCheck = validatePhone(data.phone);
  if (!phoneCheck.ok) throw new Error(phoneCheck.error);
  const phone = phoneCheck.value;
```

Dan tambahkan import:

```ts
import { validatePhone } from "@/lib/phone";
```

- [ ] **Step 6: Wajib di sisi client**

Di `src/components/karyawan/karyawan-form-dialog.tsx`, di dalam fungsi `submit`, tambahkan setelah pengecekan `branchId`:

```ts
    if (role === "TECHNICIAN") {
      const phoneCheck = validatePhone(phone);
      if (!phoneCheck.value) { toast.error("Nomor WhatsApp wajib untuk teknisi"); return; }
    }
```

Dan ganti baris field Telepon, dari:

```tsx
<div className="grid gap-1.5"><Label>Telepon</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812xxxx (opsional)" /></div>
```

menjadi:

```tsx
<div className="grid gap-1.5"><Label>Telepon{role === "TECHNICIAN" ? " *" : ""}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder={role === "TECHNICIAN" ? "0812xxxx (wajib)" : "0812xxxx (opsional)"} /></div>
```

Tambahkan import:

```ts
import { validatePhone } from "@/lib/phone";
```

- [ ] **Step 7: Tampilkan nomor dan tandai yang belum ada**

Di `src/components/karyawan/karyawan-list.tsx`, ganti baris yang menyembunyikan nomor:

```tsx
<div className="text-muted-foreground text-xs">{m.email ?? m.phone ?? "—"}</div>
```

dengan dua baris terpisah:

```tsx
<div className="text-muted-foreground text-xs">{m.email ?? "—"}</div>
<div className="text-muted-foreground text-xs">
  {m.phone ?? (m.role === "TECHNICIAN" ? <Badge variant="outline" size="sm" className="text-[9px] uppercase tracking-wider">belum ada nomor</Badge> : "—")}
</div>
```

- [ ] **Step 8: Tambahkan kolom Telepon di CSV**

Di `src/components/karyawan/export-karyawan-csv.tsx`, ubah interface:

```ts
export interface ExportKaryawanRow {
  name: string;
  email: string;
  phone: string;
  cabang: string;
  role: string;
  statusAktif: string;
  terakhirAktif: string;
}
```

Ganti `header` dan pemetaan baris:

```ts
    const header = ["Nama", "Email", "Telepon", "Cabang", "Role", "Status", "Terakhir aktif"];
    const lines = rows.map((r) =>
      [r.name, r.email, r.phone, r.cabang, r.role, r.statusAktif, r.terakhirAktif].map(csvCell).join(";")
    );
```

- [ ] **Step 9: Pastikan tipe `KaryawanData` punya phone, dan jalankan test**

Run: `npm run typecheck`
Expected: bersih. Kalau `ExportKaryawanRow` masih melaporkan `phone` hilang di `src/app/app/karyawan/page.tsx`, tambahkan `phone: k.phone ?? "—"` di tempat `ExportKaryawanRow` dibentuk di file itu.

Run: `npm test -- src/lib/auth/phone-required-actions.test.ts`
Expected: PASS — 3 test.

- [ ] **Step 10: Commit**

```bash
git add src/app/app/karyawan/actions.ts src/components/karyawan/karyawan-form-dialog.tsx src/components/karyawan/karyawan-list.tsx src/components/karyawan/export-karyawan-csv.tsx src/app/app/pengaturan/profil/actions.ts src/lib/auth/phone-required-actions.test.ts
git commit -m "feat: require a WhatsApp number for technicians and surface it"
```

---

### Task 5: Perbaiki dropdown teknisi

`getTeknisi()` di `src/app/app/servis/actions.ts:97-107` memfilter `profiles.branch_id` dan `profiles.role = 'teknisi'`. Tapi `createKaryawan` tidak pernah menulis `profiles.branch_id` — hanya `employees.branch_id`. Jadi teknisi yang dibuat lewat UI tidak muncul di dropdown, tidak bisa dipilih, dan notifikasi ke teknisi tidak akan pernah terkirim.

Ini prasyarat, bukan Tumisan: tanpa ini Task 8 tidak punya penerima.

**Files:**
- Modify: `src/app/app/servis/actions.ts:97-107`
- Test: `src/lib/operational/teknisi-source.test.ts`

**Interfaces:**
- Produces: `getTeknisi(): Promise<{ id: string; full_name: string | null; phone: string | null }[]>` — `id` adalah `profiles.id`, karena itu yang direferensikan `cervise_services.teknisi_id`
- Consumes: `orgId` dari `getBranchAndUser()` (sudah ada di baris 49-53)

- [ ] **Step 1: Tulis test penjaga yang gagal**

Buat `src/lib/operational/teknisi-source.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src", "app", "app", "servis", "actions.ts"),
  "utf8",
);

const getTeknisi = source.slice(
  source.indexOf("export async function getTeknisi"),
  source.indexOf("export async function searchCustomers"),
);

describe("sumber data dropdown teknisi", () => {
  it("membaca dari employees, bukan profiles", () => {
    expect(getTeknisi).toContain('.from("employees")');
    expect(getTeknisi).toContain('.eq("role", "TECHNICIAN")');
  });

  it("memfilter organisasi dan cabang", () => {
    expect(getTeknisi).toContain('.eq("organization_id", orgId)');
    expect(getTeknisi).toContain('.eq("branch_id", branchId)');
    expect(getTeknisi).toContain('.eq("is_active", true)');
  });

  it("tidak lagi memfilter profiles.branch_id yang selalu null", () => {
    expect(getTeknisi).not.toContain('.eq("branch_id", branchId)\n    .eq("role", "teknisi")');
    expect(getTeknisi).not.toContain('"teknisi"');
  });

  it("mengembalikan id profil, bukan id employee", () => {
    expect(getTeknisi).toContain("profiles");
    expect(getTeknisi).toContain("id: profile.id");
  });
});
```

- [ ] **Step 2: Jalankan test, harus gagal**

Run: `npm test -- src/lib/operational/teknisi-source.test.ts`
Expected: FAIL — `.from("employees")` tidak ada di `getTeknisi`.

- [ ] **Step 3: Tulis ulang `getTeknisi`**

Ganti seluruh fungsi di `src/app/app/servis/actions.ts:97-107` dengan:

```ts
export async function getTeknisi() {
  const { supabase, branchId, orgId } = await getBranchAndUser();
  // employees adalah sumber otoritas role dan cabang. profiles.branch_id tidak
  // pernah diisi createKaryawan, jadi memfilter profiles membuat dropdown ini
  // kosong. Yang dikembalikan tetap profiles.id karena
  // cervise_services.teknisi_id mereferensikan profiles(id).
  const { data, error } = await supabase
    .from("employees")
    .select("profile_id, profiles!inner(id, full_name, phone)")
    .eq("organization_id", orgId)
    .eq("branch_id", branchId)
    .eq("role", "TECHNICIAN")
    .eq("is_active", true)
    .order("full_name");
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => {
    const embedded = row.profiles as unknown;
    const profile = (Array.isArray(embedded) ? embedded[0] : embedded) as
      | { id: string; full_name: string | null; phone: string | null }
      | null;
    if (!profile) return [];
    return [{ id: profile.id, full_name: profile.full_name, phone: profile.phone ?? null }];
  });
}
```

- [ ] **Step 4: Jalankan test, harus lulus**

Run: `npm test -- src/lib/operational/teknisi-source.test.ts`
Expected: PASS — 4 test.

- [ ] **Step 5: Pastikan typecheck hijau**

Run: `npm run typecheck`
Expected: bersih. `servis-form.tsx` dan `edit-servis-form.tsx` memakai `getTeknisi()` dan hanya butuh `id` serta `full_name`, jadi kedua bentuk ini kompatibel.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/servis/actions.ts src/lib/operational/teknisi-source.test.ts
git commit -m "fix: technician dropdown reads employees instead of profiles"
```

---

### Task 6: Builder pesan

Teks pesan. Fungsi murni tanpa I/O supaya bisa diuji tanpa database maupun jaringan.

**Files:**
- Create: `src/lib/notifications/service-message.ts`
- Test: `src/lib/notifications/service-message.test.ts`

**Interfaces:**
- Produces:
  - `type ServiceMessageInput` dengan field: `storeName`, `tenantSlug`, `serviceId`, `serviceNumber`, `device`, `complaint`, `trackingCode`, `status`, `teknisiName`, `siteOrigin`
  - `publicLacakUrl(siteOrigin: string, tenantSlug: string | null, trackingCode: string | null): string`
  - `buildCustomerCreatedMessage(input: ServiceMessageInput): string`
  - `buildTechnicianCreatedMessage(input: ServiceMessageInput): string`
  - `buildCustomerStatusMessage(input: ServiceMessageInput): string`

Tidak ada builder untuk pesan status ke teknisi. Trigger hanya menaruh baris teknisi untuk `servis_created`, jadi builder itu akan jadi kode mati.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/notifications/service-message.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildCustomerCreatedMessage,
  buildCustomerStatusMessage,
  buildTechnicianCreatedMessage,
  publicLacakUrl,
  type ServiceMessageInput,
} from "./service-message";

const base: ServiceMessageInput = {
  storeName: "Servisin",
  tenantSlug: "servisin",
  serviceId: "3f1c2b44-0000-4000-8000-000000000001",
  serviceNumber: "SRV-2026-0012",
  device: "Xiaomi Redmi 13C",
  complaint: "Layar pecah, Baterai drop",
  trackingCode: "F5FB0DFCB6",
  status: "Masuk",
  siteOrigin: "https://app.cervise.id",
};

describe("publicLacakUrl", () => {
  it("menyusun tautan halaman lacak tanpa garis miring ganda", () => {
    expect(publicLacakUrl("https://app.cervise.id", "servisin", "F5FB0DFCB6")).toBe(
      "https://app.cervise.id/servisin/lacak/F5FB0DFCB6",
    );
  });

  it("mengembalikan string kosong kalau ada bagian yang tidak ada", () => {
    expect(publicLacakUrl("https://app.cervise.id", "servisin", null)).toBe("");
    expect(publicLacakUrl("https://app.cervise.id", null, "F5FB0DFCB6")).toBe("");
  });
});

describe("pesan ke customer", () => {
  it("menyebutkan nama toko, nomor servis, dan kode cek", () => {
    const message = buildCustomerCreatedMessage(base);
    expect(message).toContain("Servisin");
    expect(message).toContain("SRV-2026-0012");
    expect(message).toContain("Xiaomi Redmi 13C");
    expect(message).toContain("F5FB0DFCB6");
    expect(message).toContain("https://app.cervise.id/servisin/lacak/F5FB0DFCB6");
  });

  it("menyebutkan status baru saat status berubah", () => {
    const message = buildCustomerStatusMessage({ ...base, status: "Selesai" });
    expect(message).toContain("Selesai");
    expect(message).toContain("F5FB0DFCB6");
  });

  it("tidak pernah merender undefined atau kosong", () => {
    const sparse: ServiceMessageInput = {
      ...base,
      serviceNumber: null,
      complaint: null,
      trackingCode: null,
    };
    for (const message of [
      buildCustomerCreatedMessage(sparse),
      buildCustomerStatusMessage(sparse),
      buildTechnicianCreatedMessage(sparse),
    ]) {
      expect(message).not.toContain("undefined");
      expect(message).not.toContain("null");
      expect(message).not.toContain("NaN");
    }
  });
});

describe("pesan ke teknisi", () => {
  it("menyebutkan nomor servis dan tautan internal", () => {
    const message = buildTechnicianCreatedMessage(base);
    expect(message).toContain("Servisin");
    expect(message).toContain("SRV-2026-0012");
    expect(message).toContain("Layar pecah, Baterai drop");
    expect(message).toContain("https://app.cervise.id/app/servis/3f1c2b44-0000-4000-8000-000000000001");
  });
});
```

- [ ] **Step 2: Jalankan test, harus gagal**

Run: `npm test -- src/lib/notifications/service-message.test.ts`
Expected: FAIL — tidak bisa resolve `./service-message`.

- [ ] **Step 3: Tulis builder**

Buat `src/lib/notifications/service-message.ts`:

```ts
// Teks pesan WhatsApp. Murni: tidak menyentuh database, jaringan, atau env,
// sehingga bisa diuji langsung dan dipakai dari mana saja.
//
// Tidak ada fallback fiktif. Field yang kosong berarti barisnya dihilangkan,
// bukan diisi teks karangan, mengikuti print-templates.tsx.

export type ServiceMessageInput = {
  storeName: string;
  tenantSlug: string | null;
  serviceId: string;
  serviceNumber: string | null;
  device: string;
  complaint: string | null;
  trackingCode: string | null;
  status: string | null;
  siteOrigin: string;
};

function joinLines(lines: (string | null | undefined)[]): string {
  return lines.filter((line): line is string => Boolean(line && line.trim())).join("\n");
}

function label(text: string): string {
  // "No. Servis : ..." -> "No. Servis: ..."
  return text.replace(/\s+:\s+/, ": ");
}

function trimOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

export function publicLacakUrl(
  siteOrigin: string,
  tenantSlug: string | null,
  trackingCode: string | null,
): string {
  if (!siteOrigin || !tenantSlug || !trackingCode) return "";
  return `${trimOrigin(siteOrigin)}/${tenantSlug}/lacak/${trackingCode}`;
}

function internalServisUrl(siteOrigin: string, serviceId: string): string {
  return `${trimOrigin(siteOrigin)}/app/servis/${serviceId}`;
}

export function buildCustomerCreatedMessage(input: ServiceMessageInput): string {
  return joinLines([
    `${input.storeName} - Servis diterima`,
    label(`No. Servis : ${input.serviceNumber ?? ""}`),
    label(`Perangkat  : ${input.device}`),
    input.complaint ? label(`Keluhan    : ${input.complaint}`) : null,
    input.trackingCode ? label(`Kode cek   : ${input.trackingCode}`) : null,
    publicLacakUrl(input.siteOrigin, input.tenantSlug, input.trackingCode)
      ? `Cek status : ${publicLacakUrl(input.siteOrigin, input.tenantSlug, input.trackingCode)}`
      : null,
  ]);
}

export function buildCustomerStatusMessage(input: ServiceMessageInput): string {
  return joinLines([
    `${input.storeName} - Status servis ${input.serviceNumber ?? input.device}`,
    label(`Perangkat  : ${input.device}`),
    label(`Status     : ${input.status ?? ""}`),
    input.trackingCode ? label(`Kode cek   : ${input.trackingCode}`) : null,
    publicLacakUrl(input.siteOrigin, input.tenantSlug, input.trackingCode)
      ? `Cek status : ${publicLacakUrl(input.siteOrigin, input.tenantSlug, input.trackingCode)}`
      : null,
  ]);
}

export function buildTechnicianCreatedMessage(input: ServiceMessageInput): string {
  return joinLines([
    `${input.storeName} - Servis baru masuk`,
    input.serviceNumber ?? input.device,
    input.complaint ? `Keluhan: ${input.complaint}` : null,
    `Buka: ${internalServisUrl(input.siteOrigin, input.serviceId)}`,
  ]);
}
```

- [ ] **Step 4: Jalankan test, harus lulus**

Run: `npm test -- src/lib/notifications/service-message.test.ts`
Expected: PASS — 6 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/service-message.ts src/lib/notifications/service-message.test.ts
git commit -m "feat: WhatsApp message builders for service events"
```

---

### Task 7: Tabel outbox dan trigger

Ini bagian yang menutup semua jalur penulisan status. Ada **empat** jalur, dan grants masih mengizinkan `PATCH` langsung: table-level `UPDATE` ke `authenticated` pada `cervise_services` tidak pernah di-revoke (`20260925130000:240`). Dispatcher yang mem-poll `cervise_service_logs` akan miss jalur itu karena jalur itu tidak menulis log.

Trigger hanya menulis metadata. Isi pesan dirakit di aplikasi, karena URL halaman lacak membutuhkan origin yang tidak diketahui database.

**Files:**
- Create: `supabase/migrations/20260925220000_service_notification_outbox.sql`
- Test: `src/lib/auth/notification-outbox-migration.test.ts`

**Interfaces:**
- Produces:
  - Tabel `public.cervise_notification_outbox`
  - Trigger `cervise_services_notify_created` (AFTER INSERT) dan `cervise_services_notify_status` (AFTER UPDATE OF status)
  - RPC `public.cervise_set_notification_suppression(p_on boolean)` untuk seed script
  - Dedupe key: `servis:<id>:created:customer`, `servis:<id>:created:technician`, `servis:<id>:status:<status>:customer`

- [ ] **Step 1: Tulis test penjaga yang gagal**

Buat `src/lib/auth/notification-outbox-migration.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260925220000_service_notification_outbox.sql",
  ),
  "utf8",
);

const flat = sql.replace(/\s+/g, " ").toLowerCase();

describe("outbox notifikasi servis migration", () => {
  it("membuat tabel outbox dengan state yang terbatas", () => {
    expect(flat).toContain("create table if not exists public.cervise_notification_outbox");
    expect(flat).toContain(
      "check (state in ('pending','sent','skipped','failed'))",
    );
  });

  it("tidak memberi foreign key ke servis supaya riwayat tidak hilang", () => {
    expect(flat).toContain("servis_id uuid");
    expect(flat).not.toContain("servis_id uuid not null references");
  });

  it("membuat index antrean pending", () => {
    expect(flat).toContain("cervise_notification_outbox_pending_idx");
    expect(flat).toContain("where state = 'pending'");
  });

  it("membatasi akses hanya ke service_role", () => {
    expect(flat).toContain("alter table public.cervise_notification_outbox enable row level security");
    expect(flat).toContain("revoke all on public.cervise_notification_outbox from anon");
    expect(flat).toContain("revoke all on public.cervise_notification_outbox from authenticated");
    expect(flat).toContain("to service_role");
    // Tidak boleh ada policy: tanpa policy, hanya service_role yang bisa.
    expect(flat).not.toContain("create policy");
  });

  it("memasang trigger untuk insert dan perubahan status", () => {
    expect(flat).toContain("cervise_services_notify_created");
    expect(flat).toContain("cervise_services_notify_status");
    expect(flat).toContain("after insert on public.cervise_services");
    expect(flat).toContain("after update of status on public.cervise_services");
  });

  it("hanya menunda status kunci dan deduplikasi", () => {
    expect(flat).toContain("'selesai', 'sudah diambil'");
    expect(flat).toContain("on conflict (dedupe_key) do nothing");
    expect(flat).toContain("new.status is distinct from old.status");
  });

  it("menghormati saklar penekanan untuk seed", () => {
    expect(flat).toContain("cervise.suppress_notifications");
    expect(flat).toContain("cervise_set_notification_suppression");
  });

  it("menyediakan klaim atomik untuk dispatcher", () => {
    expect(flat).toContain("create or replace function public.claim_service_notifications");
    expect(flat).toContain("for update skip locked");
    expect(flat).toContain("set attempts = o.attempts + 1");
  });

  it("tidak mengubah hak akses tabel lain", () => {
    const privilegeLines = sql
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^(grant|revoke)\b/i.test(line));
    for (const line of privilegeLines) {
      expect(line).toContain("public.cervise_notification_outbox");
      expect(line).toContain("claim_service_notifications");
    }
  });
});
```

- [ ] **Step 2: Jalankan test, harus gagal**

Run: `npm test -- src/lib/auth/notification-outbox-migration.test.ts`
Expected: FAIL — `ENOENT`, file migration belum ada.

- [ ] **Step 3: Tulis migration**

Buat `supabase/migrations/20260925220000_service_notification_outbox.sql`:

```sql
-- Antrean notifikasi WhatsApp untuk servis.
--
-- Trigger di sini hanya menulis metadata event, tidak menyusun pesan. Isi pesan
-- dirakit di aplikasi karena URL halaman lacak butuh origin aplikasi, yang
-- tidak diketahui database.
--
-- Trigger diperlukan karena ada empat jalur penulisan status, dan grants masih
-- mengizinkan PATCH langsung ke cervise_services: jalur itu tidak menulis log
-- sama sekali, jadi dispatcher berbasis poll cervise_service_logs akan miss.

create table if not exists public.cervise_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  -- Sengaja tanpa FK. cervise_service_logs memakai on delete cascade, sehingga
  -- menghapus servis menghapus seluruh riwayatnya. Riwayat pengiriman tidak
  -- boleh ikut hilang, jadi servic_id disimpan polos.
  servis_id uuid,
  event text not null check (event in ('servis_created', 'servis_status')),
  to_kind text not null check (to_kind in ('customer', 'technician')),
  to_status text,
  dedupe_key text not null unique,
  state text not null default 'pending'
    check (state in ('pending', 'sent', 'skipped', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cervise_notification_outbox_pending_idx
  on public.cervise_notification_outbox (next_attempt_at)
  where state = 'pending';

-- Dispatcher mengklaim baris yang sudah due dalam satu statement, lalu
-- menaikkan attempts. SKIP LOCKED membuat dua worker yang jalan bersamaan
-- tidak pernah mengambil baris yang sama, tanpa perlu koordinator eksternal.
create or replace function public.claim_service_notifications(p_limit integer)
returns setof public.cervise_notification_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.cervise_notification_outbox o
     set attempts = o.attempts + 1
   where o.id in (
     select id
       from public.cervise_notification_outbox
      where state = 'pending'
        and next_attempt_at <= now()
      order by next_attempt_at
      limit greatest(coalesce(p_limit, 1), 1)
      for update skip locked
   )
  returning o.*;
end;
$$;

revoke all on function public.claim_service_notifications(integer) from public;
revoke all on function public.claim_service_notifications(integer) from anon;
revoke all on function public.claim_service_notifications(integer) from authenticated;
grant execute on function public.claim_service_notifications(integer) to service_role;

-- Trigger butuh hak SERVICE DEFINER supaya bisa menulis ke outbox meski pemanggil
-- hanya punya hak pada cervise_services. Tidak ada policy RLS di outbox, jadi
-- pemanggil langsung dari aplikasi tidak pernah bisa membacanya.
create or replace function public.cervise_enqueue_service_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Seed script menyalakan ini lewat cervise_set_notification_suppression supaya
  -- data demo tidak mengirim pesan ke nomor Fonnte asli.
  if current_setting('cervise.suppress_notifications', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.cervise_notification_outbox (
      branch_id, servis_id, event, to_kind, dedupe_key
    ) values
      (new.branch_id, new.id, 'servis_created', 'customer',
       'servis:' || new.id::text || ':created:customer'),
      (new.branch_id, new.id, 'servis_created', 'technician',
       'servis:' || new.id::text || ':created:technician')
    on conflict (dedupe_key) do nothing;
    return new;
  end if;

  if new.status is distinct from old.status
     and new.status in ('Selesai', 'Sudah Diambil') then
    insert into public.cervise_notification_outbox (
      branch_id, servis_id, event, to_kind, to_status, dedupe_key
    ) values (
      new.branch_id, new.id, 'servis_status', 'customer', new.status,
      'servis:' || new.id::text || ':status:' || new.status || ':customer'
    )
    on conflict (dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists cervise_services_notify_created on public.cervise_services;
create trigger cervise_services_notify_created
  after insert on public.cervise_services
  for each row execute function public.cervise_enqueue_service_notification();

drop trigger if exists cervise_services_notify_status on public.cervise_services;
create trigger cervise_services_notify_status
  after update of status on public.cervise_services
  for each row execute function public.cervise_enqueue_service_notification();

-- Dipakai scripts/seed-demo-data.mjs. set_config memakai is_local = false supaya
-- berlaku di sesi, karena pemanggilan berikutnya adalah statement terpisah.
-- Level sesi berarti bisa bocor ke connection pool, jadi pemanggil wajib
-- memanggilnya lagi dengan p_on = false di finally.
create or replace function public.cervise_set_notification_suppression(p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config(
    'cervise.suppress_notifications',
    case when p_on then 'on' else 'off' end,
    false
  );
end;
$$;

revoke all on function public.cervise_set_notification_suppression(boolean) from public;
revoke all on function public.cervise_set_notification_suppression(boolean) from anon;
revoke all on function public.cervise_set_notification_suppression(boolean) from authenticated;
grant execute on function public.cervise_set_notification_suppression(boolean) to service_role;

alter table public.cervise_notification_outbox enable row level security;

revoke all on public.cervise_notification_outbox from anon;
revoke all on public.cervise_notification_outbox from authenticated;
grant select, insert, update, delete on public.cervise_notification_outbox to service_role;
```

- [ ] **Step 4: Jalankan test, harus lulus**

Run: `npm test -- src/lib/auth/notification-outbox-migration.test.ts`
Expected: PASS — 9 test.

- [ ] **Step 5: Apply migration, lalu selaraskan versinya**

Apply lewat MCP Supabase dengan nama `service_notification_outbox`. Lalu:

```sql
update supabase_migrations.schema_migrations
   set version = '20260925220000'
 where name = 'service_notification_outbox'
   and version <> '20260925220000';
```

Verifikasi trigger terpasang dan privilege benar:

```sql
select tgname, pg_get_triggerdef(oid)
  from pg_trigger
 where tgrelid = 'public.cervise_services'::regclass
   and not tgisinternal;
```

```sql
select has_table_privilege('anon', 'public.cervise_notification_outbox', 'select')  as anon_read,
       has_table_privilege('authenticated', 'public.cervise_notification_outbox', 'select') as auth_read,
       has_table_privilege('service_role', 'public.cervise_notification_outbox', 'insert') as svc_insert;
```

Expected: `anon_read = false`, `auth_read = false`, `svc_insert = true`, dan dua trigger terlisting.

Lalu pastikan klaim benar-benar mengunci baris dan menaikkan `attempts`:

```sql
select count(*) as claimed from public.claim_service_notifications(3);
select count(*) as claimed_again from public.claim_service_notifications(3);
select attempts, state from public.cervise_notification_outbox order by created_at desc limit 3;
```

Expected: `claimed` lebih besar dari 0, `claimed_again = 0`, dan `attempts` naik. Kalau `claimed_again` sama dengan `claimed`, `for update skip locked` tidak bekerja dan klaim harus ditinjau.

- [ ] **Step 6: Uji trigger langsung dengan rollback**

Jalankan SQL ini. `raise exception` di akhir sengaja membatalkan transaksi, jadi tidak ada data yang tertinggal:

```sql
do $$
declare
  v_branch uuid;
  v_servis uuid;
  v_code text;
begin
  select branch_id into v_branch from public.cervise_services limit 1;

  insert into public.cervise_services (branch_id, device, price, status)
  values (v_branch, 'SMOKE OUTBOX', 0, 'Masuk')
  returning id, tracking_code into v_servis, v_code;

  raise notice 'outbox rows after insert: %',
    (select count(*) from public.cervise_notification_outbox where servis_id = v_servis);

  update public.cervise_services set status = 'Dikerjakan' where id = v_servis;
  update public.cervise_services set status = 'Selesai' where id = v_servis;

  raise notice 'outbox rows after Selesai: %',
    (select count(*) from public.cervise_notification_outbox where servis_id = v_servis);

  -- Rework tidak boleh menambah pesan: status sama lagi tidak menambah apa pun.
  update public.cervise_services set status = 'Dikerjakan' where id = v_servis;
  update public.cervise_services set status = 'Selesai' where id = v_servis;

  raise notice 'outbox rows after rework: %',
    (select count(*) from public.cervise_notification_outbox where servis_id = v_servis);

  raise exception 'ROLLBACK_SMOKE: %', v_code;
end;
$$;
```

Expected di notice: `2` setelah insert, `3` setelah `Selesai`, tetap `3` setelah rework. Pertanyaan `3` menjalankan `raise exception` yang memunculkan error HTTP, itu yang diharapkan.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260925220000_service_notification_outbox.sql src/lib/auth/notification-outbox-migration.test.ts
git commit -m "feat: notification outbox and status triggers for services"
```

---

### Task 8: Dispatcher

Tanggung jawabnya: mengklaim pesan yang sudah due, me-resolve penerima **saat dispatch** (bukan saat enqueue, supaya koreksi admin terpakai), mengirim, lalu mencatat hasilnya.

Klaim lewat RPC `claim_service_notifications` dari Task 7, bukan rantai query dari aplikasi. Alasannya `for update skip locked` memberi jaminan dua worker tidak mengambil baris yang sama dalam satu statement, dan bentuk pemanggilannya jadi satu fungsi yang mudah diuji.

**Files:**
- Create: `src/lib/notifications/dispatcher.ts`
- Test: `src/lib/notifications/dispatcher.test.ts`

**Interfaces:**
- Consumes: `sendFonnteWA`, `FonnteError` dari `src/lib/fonnte.ts` (Task 1); `toFonnteTarget` dari `src/lib/phone.ts` (Task 2); builder dari `src/lib/notifications/service-message.ts` (Task 6); `createAdminClient` dari `@/lib/supabase/admin`; RPC `claim_service_notifications` dari Task 7
- Produces: `DispatchResult = { sent: number; skipped: number; failed: number }` dan `dispatchPendingNotifications(options: { limit?: number; now?: Date; siteOrigin?: string }): Promise<DispatchResult>`

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/notifications/dispatcher.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: string;
  servis_id: string | null;
  event: "servis_created" | "servis_status";
  to_kind: "customer" | "technician";
  to_status: string | null;
  attempts: number;
};

const { mocks, state } = vi.hoisted(() => {
  const s = {
    claimed: [] as unknown[],
    servis: [] as Record<string, unknown>[],
    customers: [] as Record<string, unknown>[],
    profiles: [] as Record<string, unknown>[],
    patches: [] as { id: string; patch: Record<string, unknown> }[],
    rpcCalls: [] as { fn: string; args: unknown }[],
  };
  return {
    state: s,
    mocks: {
      createAdminClient: vi.fn(),
      sendFonnteWA: vi.fn(),
    },
  };
});

class FakeFonnteError extends Error {
  retryable: boolean;
  reason: string;
  constructor(reason: string, retryable: boolean) {
    super(`Fonnte gagal: ${reason}`);
    this.reason = reason;
    this.retryable = retryable;
  }
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

// Dispatcher memeriksa `error instanceof FonnteError`. Kalau kelas yang di-mock
// berbeda dari kelas yang dipakai di test, instanceof selalu false dan error
// yang sebenarnya permanen akan ikut di-retry. Karena itu hanya ada satu
// kelas, dengan flag retryable.
vi.mock("@/lib/fonnte", () => ({
  sendFonnteWA: mocks.sendFonnteWA,
  FonnteError: FakeFonnteError,
}));

import { dispatchPendingNotifications } from "./dispatcher";

const SERVIS = {
  id: "s1",
  service_number: "SRV-2026-0012",
  device: "Xiaomi Redmi 13C",
  complaint: "Layar pecah",
  tracking_code: "F5FB0DFCB6",
  status: "Masuk",
  customer_id: "c1",
  teknisi_id: null,
  branches: { organization_id: "o1", organizations: { name: "Servisin", slug: "servisin" } },
};

function stubAdmin() {
  return {
    rpc: async (fn: string, args: unknown) => {
      state.rpcCalls.push({ fn, args });
      return { data: state.claimed, error: null };
    },
    from: (table: string) => {
      if (table === "cervise_services") {
        return {
          select: () => ({
            in: async () => ({ data: state.servis, error: null }),
          }),
        };
      }
      if (table === "cervise_customers") {
        return {
          select: () => ({
            in: async () => ({ data: state.customers, error: null }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            in: async () => ({ data: state.profiles, error: null }),
          }),
        };
      }
      if (table === "cervise_notification_outbox") {
        return {
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, id: string) => {
              state.patches.push({ id, patch });
              return { select: async () => ({ data: [{ id }], error: null }) };
            },
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: "o1",
    servis_id: "s1",
    event: "servis_created",
    to_kind: "customer",
    to_status: null,
    attempts: 0,
    ...overrides,
  };
}

describe("dispatchPendingNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.claimed = [];
    state.servis = [];
    state.customers = [];
    state.profiles = [];
    state.patches = [];
    state.rpcCalls = [];
    mocks.createAdminClient.mockReturnValue(stubAdmin());
    mocks.sendFonnteWA.mockResolvedValue({ skip: false, status: true, detail: {} });
  });

  it("mengklaim lewat RPC dan tidak mengirim apa pun saat antrean kosong", async () => {
    const result = await dispatchPendingNotifications();

    expect(result).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(state.rpcCalls).toEqual([
      { fn: "claim_service_notifications", args: { p_limit: 25 } },
    ]);
    expect(mocks.sendFonnteWA).not.toHaveBeenCalled();
  });

  it("mengirim ke customer dalam bentuk 62 dan menandai terkirim", async () => {
    state.claimed = [row()];
    state.servis = [SERVIS];
    state.customers = [{ id: "c1", phone: "081234567890" }];

    const result = await dispatchPendingNotifications({ siteOrigin: "https://app.cervise.id" });

    expect(result.sent).toBe(1);
    expect(mocks.sendFonnteWA).toHaveBeenCalledWith(
      "6281234567890",
      expect.stringContaining("F5FB0DFCB6"),
      "62",
    );
    expect(state.patches[0].patch).toMatchObject({ state: "sent", last_error: null });
  });

  it("mengirim pesan status ke customer", async () => {
    state.claimed = [row({ event: "servis_status", to_status: "Selesai" })];
    state.servis = [{ ...SERVIS, status: "Selesai" }];
    state.customers = [{ id: "c1", phone: "628123456789" }];

    const result = await dispatchPendingNotifications({ siteOrigin: "https://app.cervise.id" });

    expect(result.sent).toBe(1);
    expect(mocks.sendFonnteWA).toHaveBeenCalledWith(
      "628123456789",
      expect.stringContaining("Selesai"),
      "62",
    );
  });

  it("melewati nomor yang tidak bisa dikirim, tanpa retry", async () => {
    state.claimed = [row()];
    state.servis = [SERVIS];
    state.customers = [{ id: "c1", phone: "0812" }];

    const result = await dispatchPendingNotifications({ siteOrigin: "https://app.cervise.id" });

    expect(result.skipped).toBe(1);
    expect(mocks.sendFonnteWA).not.toHaveBeenCalled();
    expect(state.patches[0].patch).toMatchObject({ state: "skipped", last_error: "no_phone" });
  });

  it("melewati pelanggan yang tidak ditemukan", async () => {
    state.claimed = [row()];
    state.servis = [SERVIS];
    state.customers = [];

    const result = await dispatchPendingNotifications({ siteOrigin: "https://app.cervise.id" });

    expect(result.skipped).toBe(1);
    expect(state.patches[0].patch).toMatchObject({
      state: "skipped",
      last_error: "customer_not_found",
    });
  });

  it("melewati servis yang sudah dihapus", async () => {
    state.claimed = [row()];
    state.servis = [];

    const result = await dispatchPendingNotifications({ siteOrigin: "https://app.cervise.id" });

    expect(result.skipped).toBe(1);
    expect(state.patches[0].patch).toMatchObject({
      state: "skipped",
      last_error: "servis_not_found",
    });
  });

  it("mengirim ke teknisi yang masih punya baris employees aktif", async () => {
    state.claimed = [row({ to_kind: "technician" })];
    state.servis = [{ ...SERVIS, teknisi_id: "p1" }];
    state.profiles = [
      { id: "p1", phone: "628999999999", employees: [{ organization_id: "o1", is_active: true }] },
    ];

    const result = await dispatchPendingNotifications({ siteOrigin: "https://app.cervise.id" });

    expect(result.sent).toBe(1);
    expect(mocks.sendFonnteWA).toHaveBeenCalledWith(
      "628999999999",
      expect.stringContaining("SRV-2026-0012"),
      "62",
    );
  });

  it("melewati teknisi yang sudah dinonaktifkan", async () => {
    state.claimed = [row({ to_kind: "technician" })];
    state.servis = [{ ...SERVIS, teknisi_id: "p1" }];
    state.profiles = [
      { id: "p1", phone: "628999999999", employees: [{ organization_id: "o1", is_active: false }] },
    ];

    const result = await dispatchPendingNotifications({ siteOrigin: "https://app.cervise.id" });

    expect(result.skipped).toBe(1);
    expect(mocks.sendFonnteWA).not.toHaveBeenCalled();
    expect(state.patches[0].patch).toMatchObject({
      state: "skipped",
      last_error: "technician_inactive",
    });
  });

  it("melewati teknisi yang tidak punya baris employees sama sekali", async () => {
    state.claimed = [row({ to_kind: "technician" })];
    state.servis = [{ ...SERVIS, teknisi_id: "p1" }];
    state.profiles = [{ id: "p1", phone: "628999999999", employees: [] }];

    const result = await dispatchPendingNotifications({ siteOrigin: "https://app.cervise.id" });

    expect(result.skipped).toBe(1);
    expect(state.patches[0].patch).toMatchObject({
      state: "skipped",
      last_error: "technician_inactive",
    });
  });

  it("menunda dengan backoff saat error yang bisa dicoba lagi", async () => {
    state.claimed = [row({ attempts: 1 })];
    state.servis = [SERVIS];
    state.customers = [{ id: "c1", phone: "628123456789" }];
    mocks.sendFonnteWA.mockRejectedValue(new FakeFonnteError("insufficient quota", true));

    const now = new Date("2026-09-27T10:00:00.000Z");
    const result = await dispatchPendingNotifications({ siteOrigin: "https://app.cervise.id", now });

    expect(result.failed).toBe(1);
    const patch = state.patches[0].patch;
    expect(patch.state).toBe("pending");
    expect(patch.last_error).toBe("insufficient quota");
    expect(new Date(patch.next_attempt_at as string).getTime()).toBeGreaterThan(now.getTime());
  });

  it("berhenti retry setelah empat percobaan", async () => {
    state.claimed = [row({ attempts: 4 })];
    state.servis = [SERVIS];
    state.customers = [{ id: "c1", phone: "628123456789" }];
    mocks.sendFonnteWA.mockRejectedValue(new FakeFonnteError("insufficient quota", true));

    const result = await dispatchPendingNotifications({ siteOrigin: "https://app.cervise.id" });

    expect(result.failed).toBe(1);
    expect(state.patches[0].patch).toMatchObject({ state: "failed" });
  });

  it("tidak mengulang error yang permanen", async () => {
    state.claimed = [row({ attempts: 1 })];
    state.servis = [SERVIS];
    state.customers = [{ id: "c1", phone: "628123456789" }];
    mocks.sendFonnteWA.mockRejectedValue(new FakeFonnteError("invalid target", false));

    const result = await dispatchPendingNotifications({ siteOrigin: "https://app.cervise.id" });

    expect(result.failed).toBe(1);
    expect(state.patches[0].patch).toMatchObject({
      state: "failed",
      last_error: "invalid target",
    });
  });

  it("menandai dilewati ketika Fonnte belum dikonfigurasi", async () => {
    state.claimed = [row()];
    state.servis = [SERVIS];
    state.customers = [{ id: "c1", phone: "628123456789" }];
    mocks.sendFonnteWA.mockResolvedValue({ skip: true });

    const result = await dispatchPendingNotifications({ siteOrigin: "https://app.cervise.id" });

    expect(result.skipped).toBe(1);
    expect(state.patches[0].patch).toMatchObject({
      state: "skipped",
      last_error: "fonnte_not_configured",
    });
  });

  it("membatasi jumlah baris yang diklaim sesuai limit", async () => {
    await dispatchPendingNotifications({ limit: 2 });
    expect(state.rpcCalls[0].args).toEqual({ p_limit: 2 });
  });
});
```

- [ ] **Step 2: Jalankan test, harus gagal**

Run: `npm test -- src/lib/notifications/dispatcher.test.ts`
Expected: FAIL — tidak bisa resolve `./dispatcher`.

- [ ] **Step 3: Tulis `src/lib/notifications/dispatcher.ts`**

```ts
import "server-only";

import { FonnteError, sendFonnteWA } from "@/lib/fonnte";
import { toFonnteTarget } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildCustomerCreatedMessage,
  buildCustomerStatusMessage,
  buildTechnicianCreatedMessage,
  type ServiceMessageInput,
} from "./service-message";

const MAX_ATTEMPTS = 4;
const BACKOFF_MINUTES = [1, 5, 30, 120];
const DEFAULT_LIMIT = 25;
const COUNTRY_CODE = "62";

export type DispatchResult = {
  sent: number;
  skipped: number;
  failed: number;
};

export type DispatchOptions = {
  limit?: number;
  now?: Date;
  siteOrigin?: string;
};

type OutboxRow = {
  id: string;
  servis_id: string | null;
  event: "servis_created" | "servis_status";
  to_kind: "customer" | "technician";
  to_status: string | null;
  attempts: number;
};

type ServisRow = {
  id: string;
  service_number: string | null;
  device: string;
  complaint: string | null;
  tracking_code: string | null;
  status: string | null;
  customer_id: string | null;
  teknisi_id: string | null;
  branches: { organizations: { name: string; slug: string } | null } | null;
};

type EmployeeRef = { organization_id: string; is_active: boolean };
type TechnicianRow = {
  id: string;
  phone: string | null;
  employees: EmployeeRef[] | null;
};
type CustomerRow = { id: string; phone: string | null };

type Resolved = { message: string; target: string } | { skip: string };

function backoffIso(attempts: number, from: Date): string {
  const index = Math.min(Math.max(attempts, 1) - 1, BACKOFF_MINUTES.length - 1);
  return new Date(from.getTime() + BACKOFF_MINUTES[index] * 60_000).toISOString();
}

/**
 * Menerjemahkan satu baris outbox menjadi pesan siap kirim, atau alasan kenapa
 * dilewati. Nomor sengaja dibaca di sini, bukan saat enqueue, supaya
 * perbaikan data oleh admin masih terpakai bila pesan dikirim pada percobaan
 * berikutnya.
 */
function resolveRow(
  row: OutboxRow,
  servis: ServisRow | undefined,
  customer: CustomerRow | undefined,
  technician: TechnicianRow | undefined,
  siteOrigin: string,
): Resolved {
  if (!servis) return { skip: "servis_not_found" };

  const org = servis.branches?.organizations ?? null;
  const input: ServiceMessageInput = {
    storeName: org?.name ?? "Cervise",
    tenantSlug: org?.slug ?? null,
    serviceId: servis.id,
    serviceNumber: servis.service_number,
    device: servis.device,
    complaint: servis.complaint,
    trackingCode: servis.tracking_code,
    status: row.to_status ?? servis.status,
    siteOrigin,
  };

  if (row.to_kind === "customer") {
    if (!customer) return { skip: "customer_not_found" };
    const target = toFonnteTarget(customer.phone);
    if (!target) return { skip: "no_phone" };
    return {
      target,
      message:
        row.event === "servis_created"
          ? buildCustomerCreatedMessage(input)
          : buildCustomerStatusMessage(input),
    };
  }

  if (!technician) return { skip: "technician_not_found" };
  const activeCount = (technician.employees ?? []).filter((row) => row.is_active).length;
  if (activeCount === 0) return { skip: "technician_inactive" };
  const target = toFonnteTarget(technician.phone);
  if (!target) return { skip: "no_phone" };
  return { target, message: buildTechnicianCreatedMessage(input) };
}

export async function dispatchPendingNotifications(
  options: DispatchOptions = {},
): Promise<DispatchResult> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const now = options.now ?? new Date();
  const siteOrigin = options.siteOrigin ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const result: DispatchResult = { sent: 0, skipped: 0, failed: 0 };
  const admin = createAdminClient();

  // Klaim dalam satu statement; attempts naik di database sehingga worker lain
  // tidak mengambil baris yang sama.
  const { data, error } = await admin.rpc("claim_service_notifications", { p_limit: limit });
  if (error || !data || data.length === 0) return result;

  const rows = (data as OutboxRow[]).filter((row) => row.to_kind === "customer" || row.to_kind === "technician");
  if (rows.length === 0) return result;

  const servisIds = [
    ...new Set(rows.map((row) => row.servis_id).filter((id): id is string => Boolean(id))),
  ];
  const servisById = new Map<string, ServisRow>();
  if (servisIds.length) {
    const { data: servisRows } = await admin
      .from("cervise_services")
      .select(
        "id, service_number, device, complaint, tracking_code, status, customer_id, teknisi_id, branches!inner(organizations!inner(name, slug))",
      )
      .in("id", servisIds);
    for (const row of (servisRows ?? []) as ServisRow[]) servisById.set(row.id, row);
  }

  const neededCustomerIds = [
    ...new Set(
      rows
        .map((row) => (row.to_kind === "customer" ? servisById.get(row.servis_id ?? "")?.customer_id : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const customersById = new Map<string, CustomerRow>();
  if (neededCustomerIds.length) {
    const { data: customerRows } = await admin
      .from("cervise_customers")
      .select("id, phone")
      .in("id", neededCustomerIds);
    for (const row of (customerRows ?? []) as CustomerRow[]) customersById.set(row.id, row);
  }

  const technicianIds = [
    ...new Set(
      rows
        .map((row) => (row.to_kind === "technician" ? servisById.get(row.servis_id ?? "")?.teknisi_id : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const techniciansById = new Map<string, TechnicianRow>();
  if (technicianIds.length) {
    const { data: techRows } = await admin
      .from("profiles")
      .select("id, phone, employees!inner(organization_id, is_active)")
      .in("id", technicianIds);
    for (const row of (techRows ?? []) as TechnicianRow[]) techniciansById.set(row.id, row);
  }

  for (const row of rows) {
    const servis = row.servis_id ? servisById.get(row.servis_id) : undefined;
    const customerId = row.to_kind === "customer" ? servis?.customer_id : null;
    const technicianId = row.to_kind === "technician" ? servis?.teknisi_id : null;

    const resolved = resolveRow(
      row,
      servis,
      customerId ? customersById.get(customerId) : undefined,
      technicianId ? techniciansById.get(technicianId) : undefined,
      siteOrigin,
    );

    if ("skip" in resolved) {
      await admin
        .from("cervise_notification_outbox")
        .update({ state: "skipped", last_error: resolved.skip, sent_at: now.toISOString() })
        .eq("id", row.id);
      result.skipped += 1;
      continue;
    }

    try {
      const response = await sendFonnteWA(resolved.target, resolved.message, COUNTRY_CODE);
      if (response.skip) {
        await admin
          .from("cervise_notification_outbox")
          .update({
            state: "skipped",
            last_error: "fonnte_not_configured",
            sent_at: now.toISOString(),
          })
          .eq("id", row.id);
        result.skipped += 1;
        continue;
      }
      await admin
        .from("cervise_notification_outbox")
        .update({ state: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", row.id);
      result.sent += 1;
    } catch (error) {
      const retryable = error instanceof FonnteError ? error.retryable : true;
      const reason = error instanceof FonnteError ? error.reason : String(error);
      const attempts = row.attempts + 1;

      if (!retryable || attempts >= MAX_ATTEMPTS) {
        await admin
          .from("cervise_notification_outbox")
          .update({ state: "failed", last_error: reason })
          .eq("id", row.id);
        result.failed += 1;
        continue;
      }

      await admin
        .from("cervise_notification_outbox")
        .update({
          state: "pending",
          last_error: reason,
          next_attempt_at: backoffIso(attempts, now),
        })
        .eq("id", row.id);
      result.failed += 1;
    }
  }

  return result;
}
```

- [ ] **Step 4: Jalankan test, harus lulus**

Run: `npm test -- src/lib/notifications/dispatcher.test.ts`
Expected: PASS — 14 test.

Kalau ada test yang gagal, perbaiki kode produksi, bukan test-nya. Kalau memang tidak realistis untuk disebut gagal, tulis ulang assertion-nya agar describes perilakunya, bukan bentuk pemanggilan database.


- [ ] **Step 5: Pastikan typecheck hijau**

Run: `npm run typecheck`
Expected: bersih.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notifications/dispatcher.ts src/lib/notifications/dispatcher.test.ts
git commit -m "feat: dispatch pending service notifications with retry"
```

---

### Task 9: Route cron

**Files:**
- Create: `src/app/api/cron/service-notifications/route.ts`
- Create: `src/app/api/cron/service-notifications/route.test.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `dispatchPendingNotifications` dari Task 8, `isAuthorizedCronRequest` dari `@/lib/cron-auth`

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/app/api/cron/service-notifications/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    dispatchPendingNotifications: vi.fn(),
  },
}));

vi.mock("@/lib/notifications/dispatcher", () => ({
  dispatchPendingNotifications: mocks.dispatchPendingNotifications,
}));

import { GET } from "./route";

const SECRET = "test-cron-secret";

function request(token?: string) {
  return new Request("https://app.cervise.id/api/cron/service-notifications", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("GET /api/cron/service-notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
    mocks.dispatchPendingNotifications.mockResolvedValue({
      sent: 1,
      skipped: 0,
      failed: 0,
    });
  });

  it("menolak permintaan tanpa token cron", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.dispatchPendingNotifications).not.toHaveBeenCalled();
  });

  it("menolak token yang salah", async () => {
    const response = await GET(request("salah"));
    expect(response.status).toBe(401);
  });

  it("menjalankan dispatcher dan melaporkan hasilnya", async () => {
    const response = await GET(request(SECRET));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sent: 1,
      skipped: 0,
      failed: 0,
    });
  });

  it("membatasi jumlah pesan per run", async () => {
    await GET(request(SECRET));
    expect(mocks.dispatchPendingNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25 }),
    );
  });
});
```

- [ ] **Step 2: Jalankan test, harus gagal**

Run: `npm test -- src/app/api/cron/service-notifications/route.test.ts`
Expected: FAIL — tidak bisa resolve `./route`.

- [ ] **Step 3: Tulis route**

Buat `src/app/api/cron/service-notifications/route.ts`:

```ts
import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { dispatchPendingNotifications } from "@/lib/notifications/dispatcher";

export const runtime = "nodejs";
export const maxDuration = 60;

const RUN_LIMIT = 25;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await dispatchPendingNotifications({ limit: RUN_LIMIT });
  return NextResponse.json(result);
}
```

- [ ] **Step 4: Jalankan test, harus lulus**

Run: `npm test -- src/app/api/cron/service-notifications/route.test.ts`
Expected: PASS — 4 test.

- [ ] **Step 5: Daftarkan cron di `vercel.json`**

Ganti isi `vercel.json` dengan:

```json
{
  "crons": [
    { "path": "/api/cron/subscription-renewals", "schedule": "5 * * * *" },
    { "path": "/api/cron/service-notifications", "schedule": "*/5 * * * *" }
  ]
}
```

**Ingat:** `*/5 * * * *` butuh paket Vercel Pro. Pada Hobby, Vercel menolak cron yang lebih sering dari dua kali sehari dan build akan gagal. Kalau deploy gagal dengan pesan cron, turunkan ke `"0 * * * *"`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/service-notifications/route.ts src/app/api/cron/service-notifications/route.test.ts vercel.json
git commit -m "feat: cron endpoint that drains the notification outbox"
```

---

### Task 10: Seed script tidak mengirim pesan

Seed script memakai service role, jadi trigger akan berjalan dan mencoba mengirim pesan ke nomor Fonnte asli untuk setiap baris demo.

**Files:**
- Modify: `scripts/seed-demo-data.mjs`

**Interfaces:**
- Consumes: RPC `public.cervise_set_notification_suppression(p_on boolean)` dari Task 7

- [ ] **Step 1: Tambahkan helper penekanan di dekat helper `insert`**

Di `scripts/seed-demo-data.mjs`, tepat setelah fungsi `insert` yang sudah ada, tambahkan:

```js
/**
 * Trigger notifikasi aktif juga untuk service_role, jadi seed akan mencoba
 * mengirim pesan ke nomor Fonnte asli untuk setiap baris demo. set_config di
 * sini level sesi, yang berarti bisa bocor ke connection pool PostgREST,
 * sehingga harus selalu dimatikan ulang di finally.
 */
async function withNotificationsSuppressed(fn) {
  await supabase.rpc("cervise_set_notification_suppression", { p_on: true });
  try {
    return await fn();
  } finally {
    await supabase.rpc("cervise_set_notification_suppression", { p_on: false });
  }
}
```

- [ ] **Step 2: Bungkus loop penyisipan servis**

Ganti awal blok "// 4. Servis" sehingga `for` loop berada di dalam callback. Bagian atasnya, dari `// 4. Servis` sampai `for (const s of SERVICES) {`, jadi:

```js
  // 4. Servis
  let serviceIndex = 1;
  const serviceIds = [];
  await withNotificationsSuppressed(async () => {
  for (const s of SERVICES) {
```

dan tutup kurung kurawanya tepat setelah baris `console.log(\`Servis   : ${serviceIds.length}\`);`:

```js
  console.log(`Servis   : ${serviceIds.length}`);
  });
```

Isi `for` loop di dalamnya tidak berubah sama sekali. Indentasi yang bergeser tidak berpengaruh pada kompilasi JS; yang penting kurung kurawanya seimbang.

- [ ] **Step 3: Pastikan syntax valid**

Run: `node --check scripts/seed-demo-data.mjs`
Expected: tanpa output, exit 0.

- [ ] **Step 4: Pastikan trigger benar-benar ditekan**

Jalankan seed terhadap database lokal atau staging yang sudah punya migration B terpasang, lalu:

```sql
select count(*) from public.cervise_notification_outbox;
```

Expected: `0`. Kalau ada baris, berarti pembungkusannya belum aktif dan demo akan mengirim pesan sungguhan.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-demo-data.mjs
git commit -m "fix: seed script suppresses service notifications"
```

---

### Task 11: Verifikasi penuh

**Files:** tidak ada

- [ ] **Step 1: typecheck**

Run: `npm run typecheck`
Expected: bersih.

- [ ] **Step 2: seluruh test**

Run: `npm test`
Expected: semua lulus. Jumlah test harus naik dari baseline yang ada sebelum task ini dimulai.

- [ ] **Step 3: build**

Run: `npm run build`
Expected: `Compiled successfully`, dan route `/api/cron/service-notifications` muncul di daftar route.

- [ ] **Step 4: ESLint terarah**

Run:
```bash
npx eslint src/lib/fonnte.ts src/lib/phone.ts src/lib/notifications src/app/api/cron/service-notifications
```
Expected: tidak ada error. Perhatikan `src/lib/fonnte.ts` sebelumnya sudah punya 2 error `no-explicit-any` yang warisan; kalau masih muncul, perbaiki sekalian karena file ini sudah disentuh.

- [ ] **Step 5: cek hygiene diff**

Run: `git diff --check`
Expected: bersih.

- [ ] **Step 6: pastikan kedua migration tercatat dengan versi nama file**

```sql
select version, name
  from supabase_migrations.schema_migrations
 where name in ('profile_phone_validation', 'service_notification_outbox')
 order by version;
```

Expected: versi `20260925210000` dan `20260925220000`.

- [ ] **Step 7: cek apakah ada pesan yang tertinggal di `skipped`**

```sql
select state, last_error, count(*)
  from public.cervise_notification_outbox
 group by state, last_error
 order by count(*) desc;
```

Expected sebelum cron pertama jalan: semua `pending`, atau `skipped` dengan `last_error = 'no_phone'` untuk teknisi yang belum punya nomor. Kalau muncul `failed`, investigate sebelum mengaktifkan cron.

- [ ] **Step 8: Commit kalau ada perbaikan**

```bash
git add -A
git commit -m "chore: lint fixes from the notification work"
```

Lewati langkah ini kalau `git status` bersih.
