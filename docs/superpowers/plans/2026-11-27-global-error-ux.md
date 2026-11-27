# Global Error UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tampilkan pesan error yang ramah di seluruh kaggo.app dan tandai field form yang invalid secara spesifik.

**Architecture:** Satu helper murni `friendlyErrorMessage()` memetakan error teknis ke bahasa manusia dengan default pass-through. Helper itu dipasang sekali ke objek `toast` singleton lewat jembatan yang sudah ada di `src/lib/sound.ts`, sehingga seluruh `toast.error` berubah tanpa menyentuh call site. Form prioritas memakai state error per field dan `aria-invalid` (gaya merah sudah ada di `input.tsx`).

**Tech Stack:** Next.js (App Router), React 19, Base UI, sonner, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-27-global-error-ux-design.md`

## Global Constraints

- Default **pass-through**: pesan yang sudah ramah tidak boleh diubah.
- Fallback: `"Terjadi masalah. Coba lagi."`
- Tidak boleh menampilkan stack trace, `digest`, atau teks minified ke pengguna.
- `toast.error` dengan argumen bukan string (ReactNode) diteruskan apa adanya.
- Field invalid memakai `aria-invalid` agar gaya merah bawaan `input.tsx` aktif.
- Tidak mengubah kontrak server action atau respons API.

## Review Focus

- Error teknis yang tidak dikenal → harus jadi fallback generik, bukan string mentah.
- Pesan validasi ramah ("Nama cabang wajib") → harus tetap utuh.
- `toast.error(<JSX>)` → harus tetap merender JSX, tidak berubah jadi teks.
- Field wajib kosong saat submit → harus merah + pesan di bawah field yang bersangkutan.
- Error server di luar field → harus tetap tampil di banner, tidak disembunyikan.

---

### Task 1: Helper `friendlyErrorMessage` + test

**Files:**
- Create: `src/lib/error-message.ts`
- Test: `src/lib/error-message.test.ts`

**Interfaces:**
- Produces: `friendlyErrorMessage(error: unknown, fallback?: string): string`

- [ ] **Step 1: Tulis test gagal**

```ts
import { describe, expect, it } from "vitest";
import { friendlyErrorMessage } from "./error-message";

describe("friendlyErrorMessage", () => {
  it("meneruskan pesan yang sudah ramah", () => {
    expect(friendlyErrorMessage(new Error("Nama cabang wajib"))).toBe("Nama cabang wajib");
  });

  it("memetakan duplicate key", () => {
    expect(friendlyErrorMessage(new Error('duplicate key value violates unique constraint "x"')))
      .toBe("Data sudah terdaftar. Periksa kembali.");
  });

  it("memetakan error auth", () => {
    expect(friendlyErrorMessage(new Error("Invalid login credentials")))
      .toBe("Email atau password salah.");
  });

  it("memetakan jaringan", () => {
    expect(friendlyErrorMessage(new Error("Failed to fetch")))
      .toBe("Koneksi terputus. Periksa internet lalu coba lagi.");
  });

  it("memetakan chunk error Next", () => {
    expect(friendlyErrorMessage(new Error("ChunkLoadError: Loading chunk 42 failed")))
      .toBe("Halaman perlu dimuat ulang.");
  });

  it("fallback untuk nilai tidak bermakna", () => {
    expect(friendlyErrorMessage(undefined)).toBe("Terjadi masalah. Coba lagi.");
    expect(friendlyErrorMessage("[object Object]")).toBe("Terjadi masalah. Coba lagi.");
  });

  it("membuang newline dan membatasi panjang", () => {
    const out = friendlyErrorMessage(new Error("x".repeat(300)));
    expect(out).not.toContain("\n");
    expect(out.length).toBeLessThanOrEqual(140);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**
Run: `npx vitest run src/lib/error-message.test.ts`
Expected: FAIL (modul belum ada)

- [ ] **Step 3: Implementasi minimal**

```ts
const FALLBACK = "Terjadi masalah. Coba lagi.";
const MAX_LEN = 140;

const PATTERNS: { re: RegExp; message: string }[] = [
  { re: /23505|duplicate key/i, message: "Data sudah terdaftar. Periksa kembali." },
  { re: /23503|foreign key/i, message: "Data masih dipakai di transaksi lain." },
  { re: /42501|permission denied|row-level security/i, message: "Akses ditolak. Periksa hak akses Anda." },
  { re: /PGRST|JWT|401|403/i, message: "Sesi berakhir. Silakan masuk ulang." },
  { re: /Invalid login credentials/i, message: "Email atau password salah." },
  { re: /Email not confirmed/i, message: "Email belum terverifikasi. Cek kotak masuk Anda." },
  { re: /Failed to fetch|NetworkError|ERR_/i, message: "Koneksi terputus. Periksa internet lalu coba lagi." },
  { re: /ChunkLoadError|Loading chunk|removeChild/i, message: "Halaman perlu dimuat ulang." },
];

export function friendlyErrorMessage(error: unknown, fallback = FALLBACK): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.replace(/[\r\n]+/g, " ").trim();
  if (!message || /^\[object Object\]$|^undefined$|^null$/i.test(message)) return fallback;
  const hit = PATTERNS.find((p) => p.re.test(message));
  // String minified panjang tanpa spasi dianggap teknis.
  if (!hit && message.length > MAX_LEN && !/\s/.test(message)) return fallback;
  const result = hit ? hit.message : message;
  return result.length > MAX_LEN ? `${result.slice(0, MAX_LEN - 1)}…` : result;
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**
Run: `npx vitest run src/lib/error-message.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/lib/error-message.ts src/lib/error-message.test.ts
git commit -m "feat(error): helper pesan error ramah dengan default pass-through"
```

---

### Task 2: Pasang helper ke jembatan toast global

**Files:**
- Modify: `src/lib/sound.ts` (bagian `installToastSoundBridge`, sekitar baris 445-510)
- Test: `src/lib/error-message-wiring.test.ts`

**Interfaces:**
- Consumes: `friendlyErrorMessage` dari Task 1
- Produces: `installToastSoundBridge()` tetap diekspor, kini menyaring `toast.error`

- [ ] **Step 1: Tulis test wiring gagal**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("wiring pesan error", () => {
  it("sonner memasang jembatan error", () => {
    expect(read("src/components/ui/sonner.tsx")).toContain("installToastSoundBridge()");
  });

  it("jembatan menyaring toast.error lewat helper", () => {
    const sound = read("src/lib/sound.ts");
    expect(sound).toContain("friendlyErrorMessage");
    expect(sound).toContain("api.error = (message, data)");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**
Run: `npx vitest run src/lib/error-message-wiring.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasi**

Tambah import di `src/lib/sound.ts`:
```ts
import { friendlyErrorMessage } from "./error-message";
```

Ubah wrapper `api.error`:
```ts
  if (typeof api.error === "function") {
    const original = api.error.bind(api);
    api.error = (message, data) => {
      sfx.error();
      const safeMessage =
        typeof message === "string" ? friendlyErrorMessage(message) : message;
      return original(safeMessage, data);
    };
  }
```

Ubah wrapper callback error `toast.promise`:
```ts
      callbacks.error = (value: unknown) => {
        sfx.error();
        const safe =
          typeof value === "string" ? friendlyErrorMessage(value) : value;
        return typeof originalError === "function"
          ? (originalError as (v: unknown) => unknown)(safe)
          : safe;
      };
```

- [ ] **Step 4: Jalankan test, pastikan lolos**
Run: `npx vitest run src/lib/error-message-wiring.test.ts src/lib/sound-wiring.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/lib/sound.ts src/lib/error-message-wiring.test.ts
git commit -m "feat(error): saring semua toast.error lewat jembatan global"
```

---

### Task 3: Error boundary & render error server

**Files:**
- Modify: `src/app/error.tsx`
- Modify: `src/app/global-error.tsx`
- Modify: `src/app/app/customer/page.tsx`

**Interfaces:**
- Consumes: `friendlyErrorMessage` dari Task 1

- [ ] **Step 1: Ubah label digest di `src/app/error.tsx`**

```tsx
      {error.digest ? (
        <p className="text-xs text-muted-foreground">Kode bantuan: {error.digest}</p>
      ) : null}
```

- [ ] **Step 2: Samakan label di `src/app/global-error.tsx`**

Tambah sebelum tombol "Muat ulang":
```tsx
          {error.digest ? (
            <p style={{ fontSize: 12, color: "#737373", marginTop: 12 }}>
              Kode bantuan: {error.digest}
            </p>
          ) : null}
```

- [ ] **Step 3: Bersihkan error di `src/app/app/customer/page.tsx`**

Tambah import:
```ts
import { friendlyErrorMessage } from "@/lib/error-message";
```

Ubah baris render:
```tsx
Gagal memuat data customer: {friendlyErrorMessage(error)}
```

- [ ] **Step 4: Verifikasi tipe**
Run: `npx tsc --noEmit --pretty false`
Expected: tidak ada error

- [ ] **Step 5: Commit**
```bash
git add src/app/error.tsx src/app/global-error.tsx src/app/app/customer/page.tsx
git commit -m "feat(error): label kode bantuan dan bersihkan error render server"
```

---

### Task 4: Validasi per-field pada form prioritas

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/servis/servis-form.tsx`
- Modify: `src/components/servis/edit-servis-form.tsx`
- Modify: `src/components/cash/opening-balance-dialog.tsx`
- Modify: `src/components/cash/closing-dialog.tsx`
- Modify: `src/components/cash/adjustment-dialog.tsx`
- Modify: `src/components/customer/customer-dialog.tsx`
- Modify: `src/components/cabang/create-cabang-dialog.tsx`
- Modify: `src/components/cabang/cabang-drawer.tsx`
- Modify: `src/components/servis/sparepart-dialogs.tsx`
- Test: `src/components/servis/servis-form-fields.test.ts` (perluas)

**Interfaces:**
- Consumes: `friendlyErrorMessage` dari Task 1
- Produces: pola `errors: Record<string, string>` per form

- [ ] **Step 1: Tulis test untuk pola validasi servis**

Tambah ke `src/components/servis/servis-form-fields.test.ts` (atau buat
`src/components/servis/servis-form-validation.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { validateServisForm } from "./servis-form-validation";

describe("validateServisForm", () => {
  it("menandai field yang kosong", () => {
    const errors = validateServisForm({
      teknisiId: "",
      merk: "",
      tipe: "",
      custName: "",
      custPhone: "",
    });
    expect(errors).toEqual({
      teknisiId: "Teknisi wajib diisi",
      merk: "Merk wajib",
      tipe: "Tipe wajib",
      custName: "Nama customer wajib",
      custPhone: "Kontak WA wajib",
    });
  });

  it("tidak mengembalikan error saat semua terisi", () => {
    expect(
      validateServisForm({
        teknisiId: "t1", merk: "Samsung", tipe: "S25",
        custName: "Adib", custPhone: "0895",
      }),
    ).toEqual({});
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**
Run: `npx vitest run src/components/servis/servis-form-validation.test.ts`
Expected: FAIL

- [ ] **Step 3: Buat `src/components/servis/servis-form-validation.ts`**

```ts
export type ServisFormValues = {
  teknisiId: string;
  merk: string;
  tipe: string;
  custName: string;
  custPhone: string;
};

export function validateServisForm(v: ServisFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!v.teknisiId) errors.teknisiId = "Teknisi wajib diisi";
  if (!v.merk.trim()) errors.merk = "Merk wajib";
  if (!v.tipe.trim()) errors.tipe = "Tipe wajib";
  if (!v.custName.trim()) errors.custName = "Nama customer wajib";
  if (!v.custPhone.trim()) errors.custPhone = "Kontak WA wajib";
  return errors;
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**
Run: `npx vitest run src/components/servis/servis-form-validation.test.ts`
Expected: PASS

- [ ] **Step 5: Terapkan pola di `servis-form.tsx`**

Ganti `const [error, setError] = useState<string | null>(null)` dengan
`const [errors, setErrors] = useState<Record<string, string>>({})`.

Pada submit:
```ts
    const nextErrors = validateServisForm({
      teknisiId, merk, tipe, custName, custPhone,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
```

Hapus pemanggilan validator lama yang mengembalikan satu string. Banner atas
cukup untuk error server:
```tsx
{serverError ? (
  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
    {serverError}
  </div>
) : null}
```

Pada tiap input terkait (contoh merk):
```tsx
<Input
  aria-invalid={Boolean(errors.merk)}
  value={merk}
  onChange={(e) => setMerk(e.target.value)}
/>
{errors.merk ? <p className="text-xs text-destructive">{errors.merk}</p> : null}
```

Ulangi untuk `teknisiId`, `tipe`, `custName`, `custPhone`. Error server dari
`catch` tetap dibungkus `friendlyErrorMessage(err)`.

- [ ] **Step 6: Terapkan pola yang sama di form lain**

Untuk setiap file yang tercantum di **Files**, lakukan:
- ganti state `error: string | null` menjadi `errors: Record<string, string>`;
- validasi lokal mengisi `errors[fieldName]`, bukan satu string;
- beri `aria-invalid={Boolean(errors.fieldName)}` pada input/select field itu;
- render `<p className="text-xs text-destructive">{errors.fieldName}</p>`
  tepat di bawah field;
- error hasil server action dibungkus
  `friendlyErrorMessage(e)` sebelum ditampilkan di banner;
- submit berhenti bila `Object.keys(errors).length > 0`.

Daftar field yang ditandai:
- login: `email`, `password`
- edit-servis: samakan dengan `servis-form`
- opening-balance: `saldoAwal`
- closing: `saldoAkhir`, `selisihKurang`
- adjustment: `nominal`, `keterangan`
- customer-dialog: `name`, `phone`
- create-cabang-dialog & cabang-drawer: `name`
- sparepart-dialogs: `name`, `qty` (bila ada input qty)

- [ ] **Step 7: Verifikasi**
Run: `npx tsc --noEmit --pretty false && npx vitest run`
Expected: TSC 0, seluruh test lulus

- [ ] **Step 8: Commit**
```bash
git add src/app/login/page.tsx src/components/servis src/components/cash src/components/customer src/components/cabang
git commit -m "feat(form): tandai field invalid dengan pesan spesifik"
```

---

### Task 5: Verifikasi browser & penutup

**Files:** tidak ada perubahan kode

- [ ] **Step 1: Cek error toast**
Buka aplikasi, picu error server action yang menghasilkan teks teknis
(mis. simpan cabang dengan nama duplikat). Pastikan toast menampilkan
"Data sudah terdaftar. Periksa kembali.", bukan pesan PostgREST.

- [ ] **Step 2: Cek error form**
Buka form tambah servis, submit tanpa mengisi field wajib. Pastikan field
bersangkutan berborder merah dan memuat pesan di bawahnya.

- [ ] **Step 3: Cek regresi suara**
Pastikan toast sukses tetap berbunyi chime dan toast error tetap berbunyi
shake (jembatan suara tidak rusak).

- [ ] **Step 4: Final check**
Run: `npx tsc --noEmit --pretty false && npx vitest run`
Expected: TSC 0, seluruh test lulus.
