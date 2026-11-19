# Hapus Route Absensi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghapus halaman `/absensi` dari app utama supaya hanya `absen.kaggo.app` yang menjadi tempat absensi; URL lama sengaja balas 404.

**Architecture:** Penghapusan murni tanpa fitur baru. Middleware tidak lagi mengenali `/absensi` sebagai protected path, helper actor yang hanya dipakai halaman itu dihapus, dan kode mati dibuang. Kiosk, rekap, tabel, dan RPC tidak diubah.

**Tech Stack:** Next.js 16 App Router, TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-remove-absensi-route-design.md`

## Global Constraints

- `/absensi` harus balas 404 — tidak ada redirect ke subdomain.
- Tidak ada perubahan database atau migration.
- `/app/laporan/absensi` dan `/absen-kiosk` tetap berfungsi.
- Helper `getActiveTenantForAttendance` dihapus hanya jika tidak ada pemanggil di luar direktori yang dihapus.

## Review Focus

| Input / kondisi | Perilaku yang diharapkan | Test ada di |
| --- | --- | --- |
| `getProtectedPathKind("/absensi")` | Mengembalikan `null`, bukan `"absensi"` | Task 1 |
| Masih ada import `getActiveTenantForAttendance` | Tidak ada pemanggil tersisa | Task 2 (grep) |
| Halaman `/absensi` setelah deploy | 404 | Task 3 |
| `/app/laporan/absensi` masih bisa dibuka manajer | 307 ke login saat belum login, tidak 404 | Task 3 |

---

### Task 1: Lepas `/absensi` dari protected path

**Files:** Modify `src/lib/auth/authorization.ts`, `src/lib/auth/authorization.test.ts`

**Interfaces:** `ProtectedPathKind` berubah dari `"app" | "tenant" | "absensi"` menjadi `"app" | "tenant"`.

- [ ] **Step 1: Ubah test menjadi failure**

Di `src/lib/auth/authorization.test.ts`, ganti tiga baris:

```ts
    expect(getProtectedPathKind("/absensi")).toBe("absensi");
    expect(getProtectedPathKind("/absensi/riwayat")).toBe("absensi");
    expect(getProtectedPathKind("/id/absensi")).toBe("absensi");
```

menjadi:

```ts
    expect(getProtectedPathKind("/absensi")).toBeNull();
    expect(getProtectedPathKind("/absensi/riwayat")).toBeNull();
    expect(getProtectedPathKind("/id/absensi")).toBeNull();
```

- [ ] **Step 2:** Run `npx vitest run src/lib/auth/authorization.test.ts` — Expected: FAIL (masih mengembalikan `"absensi"`).
- [ ] **Step 3: Implementasi**

Di `src/lib/auth/authorization.ts`:

```ts
export type ProtectedPathKind = "app" | "tenant";
```

dan hapus blok ini dari `getProtectedPathKind()`:

```ts
  if (withoutLocale === "/absensi" || withoutLocale.startsWith("/absensi/")) {
    return "absensi";
  }
```

- [ ] **Step 4:** Run `npx vitest run src/lib/auth/authorization.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `git add src/lib/auth/authorization.ts src/lib/auth/authorization.test.ts && git commit -m "refactor: unprotect removed /absensi path"`

---

### Task 2: Hapus halaman & helper yang sudah mati

**Files:** Delete `src/app/absensi/` (5 file); Modify `src/lib/supabase/actor.ts`

- [ ] **Step 1: Cek pemanggil helper**

Run (PowerShell):

```powershell
rg -n "getActiveTenantForAttendance" --glob '!src/app/absensi/**' src scripts 2>$null
```

Expected: hanya definisi di `src/lib/supabase/actor.ts` (baris komentar + export). Kalau ada pemanggil lain, hentikan eksekusi dan laporkan.

- [ ] **Step 2: Hapus direktori halaman**

Run: `git rm -r src/app/absensi`
Expected: 5 file terhapus (`page.tsx`, `layout.tsx`, `absensi-client.tsx`, `actions.ts`, `actions.test.ts`).

- [ ] **Step 3: Hapus helper dari actor.ts**

Hapus blok berikut beserta komentar komponennya:

```ts
/**
 * Khusus /absensi: karyawan tetap bisa absen walau tenant trial-nya habis,
 * supaya data kehadiran tidak bolong. Pemeriksaan profil/tenant/cabang tetap
 * berjalan lewat resolveTenant. Jangan dipakai di halaman /app lain.
 */
export const getActiveTenantForAttendance = cache(async (): Promise<Actor> => {
  return resolveTenant({ allowExpiredSubscription: true });
});
```

- [ ] **Step 4: Verifikasi referensi**

Run: `rg -n "/absensi|getActiveTenantForAttendance" src`
Expected: hanya kemunculan `/app/laporan/absensi` di manifest/rekap, dan tidak ada `getActiveTenantForAttendance`.

- [ ] **Step 5: Commit** `git add -A && git commit -m "refactor: remove legacy /absensi page and dead helper"`

---

### Task 3: Verifikasi akhir & deploy

- [ ] **Step 1:** Run `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`.
  Expected: 1 test baseline `lacak-appearance-css` tetap gagal; tidak ada error baru dari file yang diubah.
- [ ] **Step 2:** Push branch, buat PR ke `main`, lalu merge (dengan persetujuan user), tunggu deployment Vercel `READY`.
- [ ] **Step 3: Cek produksi**

```powershell
foreach ($p in @('/absensi','/absen-kiosk','/app/laporan/absensi')) { "$p -> " + (curl.exe -s -o NUL -w '%{http_code}' "https://cervise.vercel.app$p") }
```

Expected: `/absensi` → 404; `/absen-kiosk` → 200; `/app/laporan/absensi` → 307.
