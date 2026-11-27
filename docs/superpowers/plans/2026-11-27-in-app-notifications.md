# Notifikasi In-App per Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memberi setiap role notifikasi in-app relevan yang bisa dibuka lewat icon bell di header, dengan status baca per-user.

**Architecture:** Dua tabel Supabase (notifikasi + read receipts) dengan RLS berbasis tenant. Server action membaca role/cabang dari sesi, bukan dari client. Helper `notifyRoles` dipanggil dari server action yang sudah ada setelah mutasi berhasil, dan fail-soft agar mutasi utama tidak gagal. Komponen bell client mengambil data sekali saat mount dan memakai popover Base UI.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres + RLS, Base UI Dialog/Popover, `motion/react`, Vitest (source-text + unit test), Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-27-in-app-notifications-design.md`

## Global Constraints

- Tidak menambah dependency baru.
- Semua penulisan notifikasi terjadi di server; client tidak ever mengirim role/user id.
- Role yang dipakai: `MASTER_ADMIN`, `ADMIN`, `FRONTLINER`, `TECHNICIAN` (sumber: `src/lib/nav/manifest.ts`).
- RLS memakai helper existing `public.has_tenant_role(organization_id, text[])` — lihat `supabase/migrations/20260925220000_add_role_scoped_policies.sql`.
- Klien server: `createClient()` dari `@/lib/supabase/server`; actor: `getActiveTenant()` dari `@/lib/supabase/actor`.
- Navigasi setelah klik notifikasi: `window.location.assign(href)` (strategi navigasi penuh shell).
- Nama file migrasi: `supabase/migrations/20261127120000_app_notifications.sql`.

## Review Focus

- Role dipalsukan dari client → `getNotifications()` harus mengambil role dari `getActiveTenant()`, test di Task 3.
- Teknisi/frontliner melihat notifikasi cabang lain → `.eq("branch_id", ...)` wajib untuk non-admin, test di Task 3.
- User menandai notifikasi milik user lain terbaca → `markNotificationRead` memakai `auth.uid()` dari sesi, test di Task 3.
- Insert notifikasi gagal membuat mutasi utama gagal → `notifyRoles` fail-soft, test di Task 2.
- PATCH langsung ke DB tidak memicu notifikasi → keterbatasan yang disetujui; test di Task 1 memastikan migrasi tidak memasang trigger pada `cervise_services`.

---

### Task 1: Migrasi tabel notifikasi + RLS

**Files:**
- Create: `supabase/migrations/20261127120000_app_notifications.sql`
- Test: `src/lib/notifications/app-notifications-migration.test.ts`

**Interfaces:**
- Produces: tabel `public.cervise_app_notifications` dengan kolom `id, organization_id, branch_id, branch_label, event, audience_roles, title, body, href, created_at`; tabel `public.cervise_app_notification_reads` dengan `notification_id, user_id, read_at`.

- [ ] **Step 1: Tulis test gagal**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261127120000_app_notifications.sql"),
  "utf8",
);

describe("migrasi notifikasi in-app", () => {
  it("membuat dua tabel dengan RLS", () => {
    expect(sql).toContain("create table if not exists public.cervise_app_notifications");
    expect(sql).toContain("create table if not exists public.cervise_app_notification_reads");
    expect(sql).toContain("alter table public.cervise_app_notifications enable row level security");
    expect(sql).toContain("alter table public.cervise_app_notification_reads enable row level security");
  });

  it("mengikat reads ke auth.uid() dan tidak memasang trigger servis", () => {
    expect(sql).toContain("user_id = auth.uid()");
    expect(sql).not.toMatch(/create trigger[\s\S]*on public\.cervise_services/i);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/notifications/app-notifications-migration.test.ts`
Expected: FAIL (file migrasi belum ada).

- [ ] **Step 3: Tulis migrasi**

```sql
create table if not exists public.cervise_app_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id uuid,
  branch_label text,
  event text not null,
  audience_roles text[] not null,
  title text not null,
  body text not null,
  href text,
  created_at timestamptz not null default now()
);

create index if not exists cervise_app_notifications_org_created_idx
  on public.cervise_app_notifications (organization_id, created_at desc);
create index if not exists cervise_app_notifications_org_branch_idx
  on public.cervise_app_notifications (organization_id, branch_id);

create table if not exists public.cervise_app_notification_reads (
  notification_id uuid not null
    references public.cervise_app_notifications(id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.cervise_app_notifications enable row level security;
alter table public.cervise_app_notification_reads enable row level security;

drop policy if exists app_notifications_select on public.cervise_app_notifications;
create policy app_notifications_select on public.cervise_app_notifications
  for select to authenticated
  using (public.has_tenant_role(organization_id, array['MASTER_ADMIN','ADMIN','FRONTLINER','TECHNICIAN']::text[]));

drop policy if exists app_notifications_insert on public.cervise_app_notifications;
create policy app_notifications_insert on public.cervise_app_notifications
  for insert to authenticated
  with check (public.has_tenant_role(organization_id, array['MASTER_ADMIN','ADMIN','FRONTLINER','TECHNICIAN']::text[]));

drop policy if exists app_notification_reads_select on public.cervise_app_notification_reads;
create policy app_notification_reads_select on public.cervise_app_notification_reads
  for select to authenticated using (user_id = auth.uid());

drop policy if exists app_notification_reads_insert on public.cervise_app_notification_reads;
create policy app_notification_reads_insert on public.cervise_app_notification_reads
  for insert to authenticated with check (user_id = auth.uid());
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run src/lib/notifications/app-notifications-migration.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261127120000_app_notifications.sql src/lib/notifications/app-notifications-migration.test.ts
git commit -m "feat(notifications): add in-app notification tables and RLS"
```

---

### Task 2: Helper `notifyRoles` (fail-soft)

**Files:**
- Create: `src/lib/notifications/app-notifications.ts`
- Test: `src/lib/notifications/app-notifications.test.ts`

**Interfaces:**
- Consumes: `createClient()` dari `@/lib/supabase/server`.
- Produces: `notifyRoles(input: NotifyRolesInput): Promise<void>` dengan `NotifyRolesInput = { organizationId: string; branchId: string; branchLabel: string; event: AppNotificationEvent; roles: AppRole[]; title: string; body: string; href?: string | null }`; `AppNotificationEvent` dan `AppRole` juga diekspor dari file ini.

- [ ] **Step 1: Tulis test gagal**

```ts
import { describe, expect, it, vi } from "vitest";

const insert = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: () => ({ insert }) })),
}));

import { notifyRoles } from "./app-notifications";

describe("notifyRoles", () => {
  it("menulis notifikasi dengan audience role", async () => {
    await notifyRoles({
      organizationId: "org-1", branchId: "br-1", branchLabel: "Pusat",
      event: "servis_created", roles: ["TECHNICIAN", "FRONTLINER"],
      title: "Servis baru", body: "#SV-1", href: "/app/servis/1",
    });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      organization_id: "org-1",
      branch_id: "br-1",
      audience_roles: ["TECHNICIAN", "FRONTLINER"],
      event: "servis_created",
    }));
  });

  it("fail-soft saat insert gagal", async () => {
    insert.mockResolvedValueOnce({ error: { message: "RLS denied" } });
    await expect(notifyRoles({
      organizationId: "org-1", branchId: "br-1", branchLabel: "Pusat",
      event: "buka_toko", roles: ["MASTER_ADMIN"], title: "Buka toko", body: "Pusat",
    })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/notifications/app-notifications.test.ts`
Expected: FAIL (modul belum ada).

- [ ] **Step 3: Implementasi helper**

```ts
import { createClient } from "@/lib/supabase/server";

export type AppRole = "MASTER_ADMIN" | "ADMIN" | "FRONTLINER" | "TECHNICIAN";

export type AppNotificationEvent =
  | "servis_created" | "servis_selesai" | "pembayaran_servis"
  | "pembayaran_penjualan" | "request_stok_sparepart"
  | "stok_alert" | "sparepart_habis" | "buka_toko" | "tutup_toko";

export type NotifyRolesInput = {
  organizationId: string;
  branchId: string;
  branchLabel: string;
  event: AppNotificationEvent;
  roles: AppRole[];
  title: string;
  body: string;
  href?: string | null;
};

export async function notifyRoles(input: NotifyRolesInput): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("cervise_app_notifications").insert({
      organization_id: input.organizationId,
      branch_id: input.branchId,
      branch_label: input.branchLabel,
      event: input.event,
      audience_roles: input.roles,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
    });
    if (error) console.error("[notifications] insert failed:", error.message);
  } catch (error) {
    console.error("[notifications] helper failed:", error);
  }
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run src/lib/notifications/app-notifications.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/app-notifications.ts src/lib/notifications/app-notifications.test.ts
git commit -m "feat(notifications): add fail-soft notifyRoles helper"
```

---

### Task 3: Server action baca + tandai dibaca

**Files:**
- Create: `src/app/app/actions/notifications.ts`
- Test: `src/app/app/actions/notifications.test.ts`

**Interfaces:**
- Consumes: `getActiveTenant()`, `createClient()`, `notifyRoles` types dari Task 2.
- Produces: `NotificationItem = { id, event, title, body, href, branchLabel, createdAt, read }`, `NotificationsResult = { items: NotificationItem[], unreadCount: number }`, `getNotifications(): Promise<NotificationsResult>`, `markNotificationRead(id: string): Promise<void>`, `markAllNotificationsRead(): Promise<void>`.

- [ ] **Step 1: Tulis test gagal**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/app/actions/notifications.ts"), "utf8",
);

describe("server action notifikasi", () => {
  it("mengambil role dari sesi, bukan dari argumen client", () => {
    expect(source).toContain("getActiveTenant()");
    expect(source).toMatch(/getNotifications\(\)\s*:/);
    expect(source).not.toMatch(/getNotifications\([^)]*role/);
  });

  it("memfilter cabang untuk non-admin", () => {
    expect(source).toContain('actor.role === "MASTER_ADMIN" || actor.role === "ADMIN"');
    expect(source).toContain('.eq("branch_id", actor.branchId)');
  });

  it("menulis read receipt memakai auth.uid()", () => {
    expect(source).toContain('supabase.auth.getUser()');
    expect(source).toContain("user_id: user.id");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/app/app/actions/notifications.test.ts`
Expected: FAIL (file belum ada).

- [ ] **Step 3: Implementasi server action**

```ts
"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { createClient } from "@/lib/supabase/server";
import type { AppNotificationEvent } from "@/lib/notifications/app-notifications";

export type NotificationItem = {
  id: string;
  event: AppNotificationEvent;
  title: string;
  body: string;
  href: string | null;
  branchLabel: string | null;
  createdAt: string;
  read: boolean;
};
export type NotificationsResult = { items: NotificationItem[]; unreadCount: number };

export async function getNotifications(): Promise<NotificationsResult> {
  const actor = await getActiveTenant();
  const supabase = await createClient();
  const isAdmin = actor.role === "MASTER_ADMIN" || actor.role === "ADMIN";

  let query = supabase
    .from("cervise_app_notifications")
    .select("id, event, title, body, href, branch_label, created_at")
    .eq("organization_id", actor.orgId)
    .contains("audience_roles", [actor.role])
    .order("created_at", { ascending: false })
    .limit(20);
  if (!isAdmin && actor.branchId) query = query.eq("branch_id", actor.branchId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const ids = rows.map((row) => String(row.id));
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  let readIds = new Set<string>();
  if (userId && ids.length > 0) {
    const { data: reads } = await supabase
      .from("cervise_app_notification_reads")
      .select("notification_id")
      .eq("user_id", userId)
      .in("notification_id", ids);
    readIds = new Set((reads ?? []).map((row) => String(row.notification_id)));
  }

  const items: NotificationItem[] = rows.map((row) => ({
    id: String(row.id),
    event: row.event as AppNotificationEvent,
    title: String(row.title),
    body: String(row.body),
    href: row.href ? String(row.href) : null,
    branchLabel: row.branch_label ? String(row.branch_label) : null,
    createdAt: String(row.created_at),
    read: readIds.has(String(row.id)),
  }));
  return { items, unreadCount: items.filter((item) => !item.read).length };
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sesi tidak valid");
  const { error } = await supabase.from("cervise_app_notification_reads").upsert({
    notification_id: id,
    user_id: auth.user.id,
  });
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const result = await getNotifications();
  for (const item of result.items) {
    if (!item.read) await markNotificationRead(item.id);
  }
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run src/app/app/actions/notifications.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add src/app/app/actions/notifications.ts src/app/app/actions/notifications.test.ts
git commit -m "feat(notifications): add read and mark-read server actions"
```

---

### Task 4: Pasang event Servis

**Files:**
- Modify: `src/app/app/servis/actions.ts` (dalam `createServis`, setelah insert berhasil)
- Modify: `src/app/app/servis/sparepart-actions.ts` (dalam `updateServisStatus`, saat `nextStatus === "Selesai"`)
- Test: `src/lib/notifications/servis-events.test.ts`

**Interfaces:**
- Consumes: `notifyRoles` (Task 2).
- Produces: tidak ada interface baru.

- [ ] **Step 1: Tulis test gagal**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("event notifikasi servis", () => {
  it("createServis memberi tahu teknisi, frontliner, admin", () => {
    const source = read("src/app/app/servis/actions.ts");
    expect(source).toContain('notifyRoles({');
    expect(source).toContain('event: "servis_created"');
  });

  it("status Selesai memberi tahu frontliner dan admin", () => {
    const source = read("src/app/app/servis/sparepart-actions.ts");
    expect(source).toContain('event: "servis_selesai"');
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/notifications/servis-events.test.ts`
Expected: FAIL.

- [ ] **Step 3: Pasang helper di createServis**

Tambahkan import:
```ts
import { notifyRoles } from "@/lib/notifications/app-notifications";
```

Fungsi ini memakai `getBranchAndUser()` yang mengembalikan `{ supabase, userId, branchId, orgId }`, dan hasil insert ada di variabel `svc`. Setelah insert berhasil (sebelum `return`), panggil:
```ts
  void notifyRoles({
    organizationId: orgId,
    branchId,
    branchLabel: "",
    event: "servis_created",
    roles: ["TECHNICIAN", "FRONTLINER", "MASTER_ADMIN", "ADMIN"],
    title: "Servis baru",
    body: `${svc.service_number ?? svc.id} • ${svc.device ?? ""}`.trim(),
    href: `/app/servis/${svc.id}`,
  });
```

- [ ] **Step 4: Pasang helper di updateServisStatus**

Fungsi ini hanya punya `actor` (dari `getActor()`) dan `servisId`; tidak memuat baris servis. Tambahkan import yang sama, lalu setelah `callRpc(...)` berhasil:
```ts
  if (nextStatus.trim() === "Selesai") {
    void notifyRoles({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      branchLabel: "",
      event: "servis_selesai",
      roles: ["FRONTLINER", "MASTER_ADMIN", "ADMIN"],
      title: "Servis selesai",
      body: `Servis ${servisId} selesai`,
      href: `/app/servis/${servisId}`,
    });
  }
```

- [ ] **Step 5: Jalankan test, pastikan lolos**

Run: `npx vitest run src/lib/notifications/servis-events.test.ts`
Expected: PASS (2 test).

- [ ] **Step 6: Commit**

```bash
git add src/app/app/servis/actions.ts src/app/app/servis/sparepart-actions.ts src/lib/notifications/servis-events.test.ts
git commit -m "feat(notifications): notify servis created and completed"
```

---

### Task 5: Pasang event pembayaran, penjualan, stok, request, shift

**Files:**
- Modify: `src/app/app/servis/actions.ts` (`recordServicePayment`)
- Modify: `src/app/app/penjualan/actions.ts` (`createSale`)
- Modify: `src/app/app/sparepart/central-actions.ts` (`requestStock`)
- Modify: aksi stok inventori/sparepart yang menurunkan stok ke 0 atau di bawah ambang
- Modify: `src/app/app/actions/cash.ts` (`openShift`, `closeShift`)
- Test: `src/lib/notifications/business-events.test.ts`

**Interfaces:**
- Consumes: `notifyRoles` (Task 2).

- [ ] **Step 1: Tulis test gagal**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("event notifikasi bisnis", () => {
  it("mencakup semua event katalog", () => {
    const files = [
      "src/app/app/servis/actions.ts",
      "src/app/app/penjualan/actions.ts",
      "src/app/app/sparepart/central-actions.ts",
      "src/app/app/actions/cash.ts",
    ].map(read).join("\n");
    const events = [
      "pembayaran_servis", "pembayaran_penjualan", "request_stok_sparepart",
      "buka_toko", "tutup_toko",
    ];
    for (const event of events) expect(files).toContain(`event: "${event}"`);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/notifications/business-events.test.ts`
Expected: FAIL.

- [ ] **Step 3: Pasang helper di kelima lokasi**

Pola yang sama persis dengan Task 4: import `notifyRoles`, panggil setelah mutasi berhasil, selalu `void notifyRoles({...})`, `roles: ["MASTER_ADMIN", "ADMIN"]`. Value `title`/`body` memakai data yang sudah tersedia di fungsi tersebut (nomor servis / nomor penjualan + nominal, SKU + qty request, nama cabang + waktu untuk buka/tutup). Tujuan `href`:

- `pembayaran_servis` → `/app/servis/[id]`
- `pembayaran_penjualan` → `/app/penjualan`
- `request_stok_sparepart` → `/app/sparepart`
- `buka_toko` / `tutup_toko` → `/app/laporan/shift`

- [ ] **Step 4: Pasang event stok**

Di aksi stok sparepart, setelah stok berubah:
- jika `qty === 0` → `event: "sparepart_habis"`, `roles: ["TECHNICIAN","FRONTLINER","MASTER_ADMIN","ADMIN"]`;
- jika `0 < qty <= ambang menipis` → `event: "stok_alert"`, `roles: ["MASTER_ADMIN","ADMIN"]`.

Gunakan ambang yang sama dengan `src/lib/operational/sparepart-stock.ts` / filter "Stok menipis" — jangan hardcode angka baru.

- [ ] **Step 5: Jalankan test, pastikan lolos**

Run: `npx vitest run src/lib/notifications/business-events.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/servis/actions.ts src/app/app/penjualan/actions.ts src/app/app/sparepart/central-actions.ts src/app/app/actions/cash.ts src/lib/notifications/business-events.test.ts
git commit -m "feat(notifications): notify payments, sales, stock, requests and shifts"
```

---

### Task 6: Icon bell + integrasi header

**Files:**
- Create: `src/components/layout/notification-bell.tsx`
- Modify: `src/components/layout/shell-chrome.tsx` (tambah bell di samping `ThemeToggle`)
- Modify: `src/components/layout/compact-shell.tsx` (tambah bell di samping tombol menu, sekitar baris 257)
- Modify: `src/components/layout/compact-bottom-bar.tsx` (tambah bell di samping tombol grid mobile)
- Test: `src/components/layout/notification-bell.test.ts`

**Interfaces:**
- Consumes: `getNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `NotificationItem` (Task 3).
- Produces: `NotificationBell` component.

- [ ] **Step 1: Tulis test gagal**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("icon bell notifikasi", () => {
  it("dipasang di tiga header", () => {
    for (const file of [
      "src/components/layout/shell-chrome.tsx",
      "src/components/layout/compact-shell.tsx",
      "src/components/layout/compact-bottom-bar.tsx",
    ]) expect(read(file)).toContain("<NotificationBell");
  });

  it("fetch saat mount dan pakai popover", () => {
    const source = read("src/components/layout/notification-bell.tsx");
    expect(source).toContain("getNotifications()");
    expect(source).toContain("<Popover");
    expect(source).toContain("markAllNotificationsRead()");
    expect(source).toContain("window.location.assign");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/layout/notification-bell.test.ts`
Expected: FAIL.

- [ ] **Step 3: Buat komponen bell**

```tsx
"use client";

import { useEffect, useState } from "react";
import { BellIcon } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/app/app/actions/notifications";

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    getNotifications()
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setUnread(result.unreadCount);
      })
      .catch(() => toast.error("Gagal memuat notifikasi"));
    return () => { active = false; };
  }, []);

  const openItem = async (item: NotificationItem) => {
    if (!item.read) {
      try {
        await markNotificationRead(item.id);
        setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, read: true } : row));
        setUnread((count) => Math.max(0, count - 1));
      } catch { toast.error("Gagal menandai notifikasi"); }
    }
    if (item.href) window.location.assign(item.href);
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((row) => ({ ...row, read: true })));
      setUnread(0);
    } catch { toast.error("Gagal menandai notifikasi"); }
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Notifikasi"
            className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          />
        }
      >
        <BellIcon className="size-4" fill="currentColor" />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
            {unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifikasi</span>
          <button type="button" onClick={() => void markAll()} className="text-xs text-muted-foreground hover:text-foreground">
            Tandai semua dibaca
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Belum ada notifikasi</p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openItem(item)}
                className={cn(
                  "block w-full border-b px-3 py-2 text-left last:border-0 hover:bg-muted/50",
                  !item.read && "bg-primary/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{item.title}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("id-ID")}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{item.body}</p>
                {item.branchLabel ? (
                  <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {item.branchLabel}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Pasang di tiga header**

Di `shell-chrome.tsx`: import `NotificationBell` dari `./notification-bell`, tambahkan `<NotificationBell />` sebelum `<ThemeToggle />`.

Di `compact-shell.tsx`: import dari `@/components/layout/notification-bell`, tambahkan `<NotificationBell />` tepat sebelum `<Sheet open={open}...>` di header desktop.

Di `compact-bottom-bar.tsx`: import sama, tambahkan `<NotificationBell />` sebelum tombol grid (`aria-label="Buka menu"`) di blok `lg:hidden`.

- [ ] **Step 5: Jalankan test, pastikan lolos**

Run: `npx vitest run src/components/layout/notification-bell.test.ts`
Expected: PASS (2 test).

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/notification-bell.tsx src/components/layout/shell-chrome.tsx src/components/layout/compact-shell.tsx src/components/layout/compact-bottom-bar.tsx src/components/layout/notification-bell.test.ts
git commit -m "feat(notifications): add bell button to all shells"
```

---

### Task 7: Verifikasi akhir

**Files:** tidak ada file baru.

- [ ] **Step 1: Jalankan typecheck**

Run: `npm run typecheck`
Expected: bersih.

- [ ] **Step 2: Jalankan seluruh test**

Run: `npm test`
Expected: semua lolos.

- [ ] **Step 3: Review cakupan spec**

Buka `docs/superpowers/specs/2026-11-27-in-app-notifications-design.md` dan pastikan setiap event di katalog punya pemanggil `notifyRoles`, tiga header punya bell, dan RLS reads memakai `auth.uid()`.
