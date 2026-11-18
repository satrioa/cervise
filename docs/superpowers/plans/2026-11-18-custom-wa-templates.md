# Custom WhatsApp Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kirim 5 template WA buatan user (termasuk buka/tutup shift) dengan nama variabel dan bahasa yang benar.

**Architecture:** Registry template baru memetakan key event ke nama env + bahasa + builder parameter. Dispatcher memakai registry itu; server action kas menulis baris outbox bertipe `owner` dengan snapshot payload.

**Tech Stack:** Next.js 16, Supabase Postgres + RLS/RPC, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-custom-wa-templates-design.md`

## Global Constraints

- Nama placeholder persis: `customer`, `device`, `nomor_servis`, `complaint`, `estimated`, `tenant`, `cabang`, `nama_customer`, `service_number`, `nama_teknisi`, `user-open`, `date_open`, `saldo_awal`, `date`, `shift_open_time`, `user-close`, `shift_close_time`, `saldo_akhir`.
- Bahasa: `id` untuk servis_masuk/status/shift_open, `en` untuk teknisi/shift_close.
- Value kosong = `"-"`.
- Env lama `META_WA_TEMPLATE_INVOICE/STATUS/TECHNICIAN` tetap jadi fallback.
- Penerima shift = owner_phone → contact_phone; kosong → skip.

## Review Focus

- Template status memakai `{{nama_customer}}` (bukan `customer`) → Task 1 test.
- Shift close memakai `{{date}}` (typo di chat user sudah dikonfirmasi) → Task 1 test.
- Bahasa `en` untuk teknisi & shift_close → Task 1 test.
- Owner tanpa nomor tidak boleh gagal permanen → Task 3 test.
- Baris outbox lama tanpa `payload` tetap bisa di-skip dengan aman → Task 3 test.

---

### Task 1: Registry template & bahasa

**Files:** Create `src/lib/notifications/wa-templates.ts`, `src/lib/notifications/wa-templates.test.ts`; Modify `src/lib/meta-wa.ts`.

- [ ] **Step 1: Tulis test gagal** — assertion key template, language, dan daftar `parameter_name`.
- [ ] **Step 2: Jalankan, pastikan gagal** — `npx vitest run src/lib/notifications/wa-templates.test.ts`.
- [ ] **Step 3: Implementasi registry** — `WaTemplateKey`, `WaTemplate`, `getWaTemplate(key)`; `sendMetaWA` terima arg `language` kelima, default `"id"`.
- [ ] **Step 4: Test lolos**.
- [ ] **Step 5: Commit** — `feat(wa): template registry with per-template language`.

### Task 2: Parameter builder servis

**Files:** Modify `src/lib/notifications/service-message.ts`, `src/lib/notifications/service-message.test.ts`, `src/lib/notifications/dispatcher.ts`.

- [ ] **Step 1: Test gagal** — assertion parameter names baru.
- [ ] **Step 2: Jalankan, pastikan gagal**.
- [ ] **Step 3: Implementasi** — input fields baru; builder `buildServisMasukParameters`, `buildServisStatusParameters`, `buildTechnicianParameters`; dispatcher select `branches(name)`, `cervise_customers.name`, `profiles.full_name`.
- [ ] **Step 4: Test lolos**.
- [ ] **Step 5: Commit** — `feat(wa): map custom template placeholders`.

### Task 3: Event shift & payload outbox

**Files:** Create migration `supabase/migrations/20261118120000_wa_shift_notifications.sql`; Modify `src/app/app/actions/cash.ts`, `src/lib/notifications/dispatcher.ts`, `src/lib/notifications/dispatcher.test.ts`, `src/lib/auth/notification-outbox-migration.test.ts`.

- [ ] **Step 1: Test gagal** — migration constraint & dispatcher owner skip.
- [ ] **Step 2: Jalankan, pastikan gagal**.
- [ ] **Step 3: Implementasi** — migration (event/to_kind/payload), enqueue di open/close, dispatcher owner resolver & shift params.
- [ ] **Step 4: Test lolos**.
- [ ] **Step 5: Commit** — `feat(wa): shift open/close notifications to owner`.

### Task 4: Env & verifikasi akhir

**Files:** Modify `.env.example`.

- [ ] **Step 1: Tambah 5 env var baru** dengan contoh nama template.
- [ ] **Step 2: Jalankan** `npm run build` dan `npm test -- --run`; pastikan hijau.
- [ ] **Step 3: Commit** — `docs(wa): document custom template env vars`.
