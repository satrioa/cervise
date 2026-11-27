# Gudang Pusat Inventori Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Item sparepart & produk menjadi master data tenant di gudang pusat; master admin mendistribusikan stok ke cabang, cabang hanya bisa request stok yang perlu persetujuan.

**Architecture:** Tabel master `cervise_central_items` + `cervise_stock_requests` baru; tabel `cervise_spareparts`/`cervise_products` tetap dipakai sebagai baris stok cabang dengan FK `central_item_id`. Semua perpindahan lewat RPC `security definer` yang menulis dua baris ledger dalam satu transaksi. UI tetap satu halaman `/app/sparepart` dengan toggle scope.

**Tech Stack:** Next.js 16.3.6 (App Router, server actions), Supabase Postgres + RLS, Vitest 3, TypeScript, shadcn/Base UI.

**Spec:** `docs/superpowers/specs/2026-11-27-gudang-pusat-inventori-design.md`

## Global Constraints
- Jalankan `npm run typecheck`, `npm run lint`, `npm test` sebelum commit terakhir.
- Migration SQL memakai pola `create table if not exists` / `add column if not exists` / `drop policy if exists` seperti migration lain di `supabase/migrations/`.
- Test migration adalah assertion string terhadap isi file SQL (pola `src/lib/auth/custom-sparepart-migration.test.ts`), bukan koneksi DB.
- Test server action memakai `vi.hoisted` + `vi.mock("@/lib/supabase/actor", ...)` + `vi.mock("next/cache", ...)` seperti `src/app/app/servis/sparepart-actions.test.ts`.
- Semua RPC penulisan: `security definer`, `set search_path = public`, `revoke all ... from public/anon`, lalu `grant execute ... to authenticated`. Cek role **di dalam** RPC, jangan hanya di server action.
- `cervise_stock_movements.branch_id` **tetap NOT NULL**; baris sisi-pusat memakai `branch_id` cabang yang terlibat + penanda `is_central_side = true`.
- `apply_stock_delta` dan `apply_sparepart_stock_delta` harus menerima alasan baru; jangan menulis ledger langsung dari klien.
- "Satu halaman" = satu halaman **pengelolaan gudang pusat** (`/app/sparepart`) untuk sparepart dan produk. `/app/inventori` tetap ada untuk lihat stok cabang/opname, tapi bukan tempat membuat item baru.
- Tanpa dependency baru.

## Review Focus
- **Stok pusat tidak cukup** saat distribusi/approve → harus gagal penuh, tanpa baris cabang atau ledger yang setengah jalan (test di Task 4).
- **Unit serialized dipilih dua kali / beda IMEI** → harus ditolak; tiap IMEI adalah satu unit atomik (test di Task 4).
- **Cabang menyiasati UI** dengan memanggil server action untuk membuat item / mengubah harga → harus ditolak di server action dan RLS (test di Task 5).
- **Migrasi kehilangan stok** → total stok sebelum dan sesudah harus sama persis (test di Task 2).
- **Request PENDING ganda / approve konkuren** → request ganda ditolak; approve memakai `expected_stock` dan menolak jika stok berubah (test di Task 4).

---

## File Structure

**Create:**
- `supabase/migrations/20261127120000_central_inventory_schema.sql` — tabel master, request, kolom FK, RLS, alasan ledger baru.
- `supabase/migrations/20261127130000_central_inventory_migrate_stock.sql` — tarik semua stok cabang ke pusat.
- `src/lib/auth/central-inventory-migration.test.ts` — assertion string untuk kedua migration.
- `src/app/app/sparepart/central-actions.ts` — server actions gudang pusat.
- `src/app/app/sparepart/central-actions.test.ts` — test action.
- `src/components/sparepart/central-stock-dialogs.tsx` — dialog distribusi, request, approve.

**Modify:**
- `supabase/migrations/20261117120000_stock_opname.sql` — **tidak** diedit (migration lama); alasan baru ditambahkan di migration baru lewat `create or replace function`.
- `src/app/app/sparepart/actions.ts` — list gabungan pusat+cabang, hapus create/update dari cabang.
- `src/app/app/sparepart/actions.test.ts` (baru) — test pembatasan cabang.
- `src/app/app/sparepart/page.tsx` — kirim `isMasterAdmin`.
- `src/app/app/sparepart/sparepart-client.tsx` — toggle scope, tombol request/approve/distribusi.
- `src/app/app/sparepart/central-ui.test.ts` — assertion string untuk UI.
- `src/app/app/inventori/actions.ts` — `updateProductVariant` tidak lagi mengubah field master; create/import produk hanya master admin lewat action pusat.

---

### Task 1: Schema master pusat, request, dan alasan ledger

**Files:**
- Create: `supabase/migrations/20261127120000_central_inventory_schema.sql`
- Test: `src/lib/auth/central-inventory-migration.test.ts`

**Interfaces:**
- Produces: `public.cervise_central_items`, `public.cervise_stock_requests`, kolom `central_item_id` di `cervise_spareparts`, `cervise_products`, `cervise_stock_movements`, kolom `is_central_side`/`request_id` di movements, alasan ledger `central_purchase|distribute|request_in|return_to_central`.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261127120000_central_inventory_schema.sql"),
  "utf8",
);
const flat = sql.replace(/\s+/g, " ").toLowerCase();

describe("central inventory schema migration", () => {
  it("membuat tabel master pusat dan antrean request", () => {
    expect(flat).toContain("create table if not exists public.cervise_central_items");
    expect(flat).toContain("create table if not exists public.cervise_stock_requests");
  });

  it("menautkan baris cabang dan ledger ke item pusat", () => {
    expect(flat.match(/add column if not exists central_item_id uuid/g)).toHaveLength(3);
    expect(flat).toContain("is_central_side boolean not null default false");
  });

  it("mengizinkan alasan ledger baru", () => {
    for (const reason of ["central_purchase", "distribute", "request_in", "return_to_central"]) {
      expect(flat).toContain(`'${reason}'`);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/central-inventory-migration.test.ts -v`
Expected: FAIL — file migration belum ada.

- [ ] **Step 3: Write minimal implementation**

Isi `20261127120000_central_inventory_schema.sql`:

```sql
-- Master data tenant. Baris cabang di tabel lama jadi "stok saja".
create table if not exists public.cervise_central_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('SPAREPART','PRODUCT')),
  sku text not null,
  name text not null,
  category text not null default 'Sparepart',
  cost integer not null default 0 check (cost >= 0),
  price integer not null default 0 check (price >= 0),
  is_active boolean not null default true,
  is_serialized boolean not null default false,
  imei text,
  barcode text,
  variant_type text not null default 'BARU' check (variant_type in ('BARU','BEKAS')),
  storage text,
  warna text,
  bh_percent integer check (bh_percent is null or bh_percent between 0 and 100),
  kondisi_notes text,
  garansi_days integer check (garansi_days is null or garansi_days > 0),
  parent_key text,
  stock_qty integer not null default 0 check (stock_qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cervise_central_items_sku_key
  on public.cervise_central_items(organization_id, kind, sku) where not is_serialized;
create unique index if not exists cervise_central_items_imei_key
  on public.cervise_central_items(organization_id, imei) where imei is not null;
create index if not exists cervise_central_items_org_kind_idx
  on public.cervise_central_items(organization_id, kind, name);

alter table public.cervise_central_items enable row level security;
drop policy if exists cervise_central_items_select on public.cervise_central_items;
create policy cervise_central_items_select on public.cervise_central_items
  for select to authenticated
  using (public.is_platform_admin() or public.has_tenant_role(
    organization_id, array['MASTER_ADMIN','ADMIN','FRONTLINER','TECHNICIAN']::text[]));
grant select on public.cervise_central_items to authenticated;
grant all on public.cervise_central_items to service_role;

create table if not exists public.cervise_stock_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  central_item_id uuid references public.cervise_central_items(id) on delete set null,
  sku text not null,
  qty integer not null check (qty > 0),
  decided_qty integer check (decided_qty is null or decided_qty > 0),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  note text,
  rejection_reason text,
  requested_by uuid references public.profiles(id) on delete set null,
  decided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists cervise_stock_requests_branch_status_idx
  on public.cervise_stock_requests(branch_id, status, created_at desc);
alter table public.cervise_stock_requests enable row level security;
drop policy if exists cervise_stock_requests_select on public.cervise_stock_requests;
create policy cervise_stock_requests_select on public.cervise_stock_requests
  for select to authenticated
  using (public.is_platform_admin() or public.has_tenant_role(
    organization_id, array['MASTER_ADMIN','ADMIN','FRONTLINER','TECHNICIAN']::text[]));
drop policy if exists cervise_stock_requests_insert on public.cervise_stock_requests;
create policy cervise_stock_requests_insert on public.cervise_stock_requests
  for insert to authenticated
  with check (public.is_platform_admin() or public.has_tenant_branch_role(
    organization_id, branch_id, array['ADMIN','FRONTLINER']::text[]));
drop policy if exists cervise_stock_requests_update on public.cervise_stock_requests;
create policy cervise_stock_requests_update on public.cervise_stock_requests
  for update to authenticated
  using (public.is_platform_admin() or public.has_tenant_role(organization_id, array['MASTER_ADMIN']::text[]))
  with check (public.is_platform_admin() or public.has_tenant_role(organization_id, array['MASTER_ADMIN']::text[]));
grant select, insert, update on public.cervise_stock_requests to authenticated;

alter table public.cervise_spareparts
  add column if not exists central_item_id uuid references public.cervise_central_items(id) on delete restrict;
alter table public.cervise_products
  add column if not exists central_item_id uuid references public.cervise_central_items(id) on delete restrict;
alter table public.cervise_stock_movements
  add column if not exists central_item_id uuid references public.cervise_central_items(id) on delete restrict;
alter table public.cervise_stock_movements
  add column if not exists is_central_side boolean not null default false;
alter table public.cervise_stock_movements
  add column if not exists request_id uuid references public.cervise_stock_requests(id) on delete set null;

alter table public.cervise_stock_movements
  drop constraint if exists cervise_stock_movements_reason_check;
alter table public.cervise_stock_movements
  add constraint cervise_stock_movements_reason_check check (reason in (
    'service_use','service_return','sale','sale_return','stock_adjust',
    'purchase','transfer_in','transfer_out',
    'central_purchase','distribute','request_in','return_to_central'));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/central-inventory-migration.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations/20261127120000_central_inventory_schema.sql src/lib/auth/central-inventory-migration.test.ts
git commit -m "feat(db): schema gudang pusat dan antrean request stok"
```

---

### Task 2: Migrasi stok cabang ke gudang pusat

**Files:**
- Create: `supabase/migrations/20261127130000_central_inventory_migrate_stock.sql`
- Modify: `src/lib/auth/central-inventory-migration.test.ts`
- Consumes: `cervise_central_items`, `central_item_id`, alasan `return_to_central` dari Task 1.

**Interfaces:**
- Produces: semua baris `cervise_spareparts`/`cervise_products` memiliki `central_item_id` dan `stock_qty = 0`; total `stock_qty` pusat = total stok cabang lama.

- [ ] **Step 1: Write the failing test**

Tambahkan ke file test Task 1:

```ts
const migrate = readFileSync(
  join(process.cwd(), "supabase/migrations/20261127130000_central_inventory_migrate_stock.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("central inventory stock migration", () => {
  it("memindahkan stok dengan ledger, bukan update diam-diam", () => {
    expect(migrate).toContain("insert into public.cervise_central_items");
    expect(migrate).toContain("'return_to_central'");
    expect(migrate).toContain("update public.cervise_spareparts set stock_qty = 0");
    expect(migrate).toContain("update public.cervise_products set stock_qty = 0");
  });

  it("mengunci migrasi dalam satu transaksi", () => {
    expect(migrate).toContain("begin;");
    expect(migrate).toContain("commit;");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/central-inventory-migration.test.ts -v`
Expected: FAIL — file migrasi data belum ada.

- [ ] **Step 3: Write minimal implementation**

Isi `20261127130000_central_inventory_migrate_stock.sql`:

```sql
-- Jalankan sekali, di luar jam operasional. Snapshot tabel sebelum deploy.
begin;

-- Sparepart: satu baris pusat per (org, sku), stok = total semua cabang.
insert into public.cervise_central_items (
  organization_id, kind, sku, name, category, cost, price, is_active, stock_qty
)
select organization_id, 'SPAREPART', sku,
       (array_agg(name order by created_at, id))[1],
       (array_agg(category order by created_at, id))[1],
       (array_agg(cost order by created_at, id))[1],
       (array_agg(price order by created_at, id))[1],
       true,
       sum(stock_qty)::integer
from public.cervise_spareparts
where is_active
group by organization_id, sku
on conflict do nothing;

-- Produk non-serial: pola sama.
insert into public.cervise_central_items (
  organization_id, kind, sku, name, category, cost, price, is_active,
  barcode, variant_type, storage, warna, bh_percent, kondisi_notes, garansi_days, parent_key, stock_qty
)
select organization_id, 'PRODUCT', sku,
       (array_agg(name order by created_at, id))[1],
       (array_agg(category order by created_at, id))[1],
       (array_agg(cost order by created_at, id))[1],
       (array_agg(price order by created_at, id))[1],
       true,
       (array_agg(barcode order by created_at, id))[1],
       (array_agg(variant_type order by created_at, id))[1],
       (array_agg(storage order by created_at, id))[1],
       (array_agg(warna order by created_at, id))[1],
       (array_agg(bh_percent order by created_at, id))[1],
       (array_agg(kondisi_notes order by created_at, id))[1],
       (array_agg(garansi_days order by created_at, id))[1],
       (array_agg(parent_key order by created_at, id))[1],
       sum(stock_qty)::integer
from public.cervise_products
where is_active and not is_serialized
group by organization_id, sku
on conflict do nothing;

-- Produk serialized: satu baris pusat per IMEI (bukan per SKU).
insert into public.cervise_central_items (
  organization_id, kind, sku, name, category, cost, price, is_active, is_serialized, imei,
  variant_type, storage, warna, bh_percent, kondisi_notes, garansi_days, parent_key, stock_qty
)
select organization_id, 'PRODUCT', sku, name, category, cost, price, true, true, imei,
       variant_type, storage, warna, bh_percent, kondisi_notes, garansi_days, parent_key, 1
from public.cervise_products
where is_active and is_serialized and imei is not null and stock_qty > 0
on conflict (organization_id, imei) where imei is not null do nothing;

-- Snapshot SEBELUM stok cabang di-set 0: kalau tidak, qty ledger jadi nol.
create temp table central_migrate_sparepart as
select s.id as row_id, s.branch_id, c.id as central_item_id, s.stock_qty as qty
from public.cervise_spareparts s
join public.cervise_central_items c
  on c.organization_id = s.organization_id and c.kind = 'SPAREPART' and c.sku = s.sku
where s.stock_qty <> 0;

create temp table central_migrate_product as
select p.id as row_id, p.branch_id, c.id as central_item_id, p.stock_qty as qty
from public.cervise_products p
join public.cervise_central_items c
  on c.organization_id = p.organization_id and c.kind = 'PRODUCT'
  and ((not p.is_serialized and c.sku = p.sku and not c.is_serialized)
       or (p.is_serialized and c.imei = p.imei))
where p.stock_qty <> 0;

-- Ledger: dua baris return_to_central per baris stok lama (cabang -, pusat +).
insert into public.cervise_stock_movements (
  branch_id, sparepart_id, central_item_id, qty_delta, reason, is_central_side, actor_id
)
select branch_id, row_id, central_item_id, -qty, 'return_to_central', false, null
from central_migrate_sparepart;

insert into public.cervise_stock_movements (
  branch_id, product_id, central_item_id, qty_delta, reason, is_central_side, actor_id
)
select branch_id, row_id, central_item_id, -qty, 'return_to_central', false, null
from central_migrate_product;

insert into public.cervise_stock_movements (
  branch_id, central_item_id, qty_delta, reason, is_central_side, actor_id
)
select branch_id, central_item_id, qty, 'return_to_central', true, null
from central_migrate_sparepart;

insert into public.cervise_stock_movements (
  branch_id, central_item_id, qty_delta, reason, is_central_side, actor_id
)
select branch_id, central_item_id, qty, 'return_to_central', true, null
from central_migrate_product;

-- Baru setelah ledger tercatat, stok cabang di-set 0 dan ditautkan ke pusat.
update public.cervise_spareparts s
set central_item_id = c.id, stock_qty = 0, updated_at = now()
from public.cervise_central_items c
where c.organization_id = s.organization_id
  and c.kind = 'SPAREPART'
  and c.sku = s.sku;

update public.cervise_products p
set central_item_id = c.id, stock_qty = 0, updated_at = now()
from public.cervise_central_items c
where c.organization_id = p.organization_id
  and c.kind = 'PRODUCT'
  and ((not p.is_serialized and c.sku = p.sku and not c.is_serialized)
       or (p.is_serialized and c.imei = p.imei));

commit;
```

> `shortcut: migrasi hanya dijalankan sekali pada snapshot bersih; jika perlu re-run, tambahkan penanda migrasi — upgrade saat ada kebutuhan re-run.`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/central-inventory-migration.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations/20261127130000_central_inventory_migrate_stock.sql src/lib/auth/central-inventory-migration.test.ts
git commit -m "feat(db): tarik stok cabang ke gudang pusat dengan ledger"
```

---

### Task 3: RPC master item, beli stok pusat, dan ledger pusat

**Files:**
- Create: `supabase/migrations/20261127140000_central_inventory_rpc.sql`
- Modify: `src/lib/auth/central-inventory-migration.test.ts`
- Consumes: tabel & alasan dari Task 1.

**Interfaces:**
- Produces: `public.create_central_item(...) returns uuid`, `public.purchase_central_stock(...) returns integer`, internal `public.apply_central_stock_delta(...) returns integer`, helper `public.central_ledger_branch(uuid) returns uuid`.

- [ ] **Step 1: Write the failing test**

```ts
const rpc = readFileSync(
  join(process.cwd(), "supabase/migrations/20261127140000_central_inventory_rpc.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("central inventory rpc inti", () => {
  it("hanya master admin yang bisa membuat item dan membeli stok", () => {
    expect(rpc).toContain("array['master_admin'::text]");
    expect(rpc).toContain("create or replace function public.create_central_item");
    expect(rpc).toContain("create or replace function public.purchase_central_stock");
  });

  it("mengamankan RPC dari anon dan memberi execute ke authenticated", () => {
    expect(rpc).toContain("revoke all on function public.create_central_item");
    expect(rpc).toContain("grant execute on function public.create_central_item");
    expect(rpc).toContain("create or replace function public.update_central_item");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/central-inventory-migration.test.ts -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Isi `20261127140000_central_inventory_rpc.sql`. Kunci: whitelist alasan di `apply_stock_delta` dan `apply_sparepart_stock_delta` diperluas lewat `create or replace function` dengan signature 7/5 argumen yang sama seperti di `20261117120000_stock_opname.sql` dan `20261106100000_sparepart_purchase_transfer.sql` (salin body lengkapnya, ubah hanya daftar `p_reason not in (...)`).

```sql
-- Anchor ledger untuk sisi pusat: cabang pertama tenant (bukan gudang).
create or replace function public.central_ledger_branch(p_organization_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.branches where organization_id = p_organization_id order by created_at limit 1;
$$;
revoke all on function public.central_ledger_branch(uuid) from public, anon, authenticated;

create or replace function public.apply_central_stock_delta(
  p_central_item_id uuid, p_delta integer, p_expected_stock integer default null,
  p_reason text, p_branch_id uuid, p_request_id uuid default null
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_item public.cervise_central_items%rowtype;
  v_next integer;
begin
  if p_delta is null or p_delta = 0 then raise exception 'delta stok tidak boleh nol'; end if;
  if p_delta > 1000 or p_delta < -1000 then raise exception 'delta stok di luar batas'; end if;
  if p_reason not in ('central_purchase','distribute','request_in','return_to_central') then
    raise exception 'alasan perubahan stok tidak valid';
  end if;
  select * into v_item from public.cervise_central_items where id = p_central_item_id for update;
  if not found then raise exception 'item pusat tidak ditemukan'; end if;
  if p_expected_stock is not null and p_expected_stock <> v_item.stock_qty then
    raise exception 'stok pusat berubah oleh transaksi lain, muat ulang';
  end if;
  v_next := v_item.stock_qty + p_delta;
  if v_next < 0 then raise exception 'stok pusat tidak cukup'; end if;
  update public.cervise_central_items set stock_qty = v_next, updated_at = now() where id = v_item.id;
  insert into public.cervise_stock_movements (
    branch_id, central_item_id, qty_delta, reason, is_central_side, request_id, actor_id
  ) values (p_branch_id, v_item.id, p_delta, p_reason, true, p_request_id, auth.uid());
  return v_next;
end;
$$;
revoke all on function public.apply_central_stock_delta(uuid, integer, integer, text, uuid, uuid) from public, anon, authenticated;

create or replace function public.create_central_item(
  p_organization_id uuid, p_kind text, p_sku text, p_name text, p_category text,
  p_cost integer, p_price integer, p_stock_qty integer default 0,
  p_is_serialized boolean default false, p_imei text default null, p_parent_key text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_branch uuid;
begin
  if not (public.is_platform_admin() or public.has_tenant_role(p_organization_id, array['MASTER_ADMIN'::text])) then
    raise exception 'hanya master admin yang boleh membuat item';
  end if;
  if p_kind not in ('SPAREPART','PRODUCT') then raise exception 'jenis item tidak valid'; end if;
  if p_is_serialized and p_imei is null then raise exception 'IMEI wajib untuk unit serialized'; end if;
  insert into public.cervise_central_items (
    organization_id, kind, sku, name, category, cost, price, stock_qty, is_serialized, imei, parent_key
  ) values (
    p_organization_id, p_kind, trim(p_sku), trim(p_name), p_category, p_cost, p_price,
    0, p_is_serialized, p_imei, p_parent_key
  ) returning id into v_id;
  if p_stock_qty > 0 then
    v_branch := public.central_ledger_branch(p_organization_id);
    perform public.apply_central_stock_delta(v_id, p_stock_qty, null, 'central_purchase', v_branch, null);
  end if;
  return v_id;
end;
$$;
revoke all on function public.create_central_item(uuid, text, text, text, text, integer, integer, integer, boolean, text, text) from public, anon;
grant execute on function public.create_central_item(uuid, text, text, text, text, integer, integer, integer, boolean, text, text) to authenticated;

-- Edit master data hanya master admin; stok tidak disentuh di sini.
create or replace function public.update_central_item(
  p_central_item_id uuid, p_name text, p_category text, p_cost integer, p_price integer
)
returns void language plpgsql security definer set search_path = public as $$
declare v_item public.cervise_central_items%rowtype;
begin
  select * into v_item from public.cervise_central_items where id = p_central_item_id for update;
  if not found then raise exception 'item pusat tidak ditemukan'; end if;
  if not (public.is_platform_admin() or public.has_tenant_role(v_item.organization_id, array['MASTER_ADMIN'::text])) then
    raise exception 'hanya master admin yang boleh mengubah item';
  end if;
  update public.cervise_central_items
  set name = trim(p_name), category = p_category, cost = p_cost, price = p_price, updated_at = now()
  where id = v_item.id;
end;
$$;
revoke all on function public.update_central_item(uuid, text, text, integer, integer) from public, anon;
grant execute on function public.update_central_item(uuid, text, text, integer, integer) to authenticated;

create or replace function public.purchase_central_stock(
  p_central_item_id uuid, p_qty integer, p_unit_cost integer default null, p_expected_stock integer default null
)
returns integer language plpgsql security definer set search_path = public as $$
declare v_item public.cervise_central_items%rowtype;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'jumlah pembelian harus lebih dari nol'; end if;
  select * into v_item from public.cervise_central_items where id = p_central_item_id for update;
  if not found then raise exception 'item pusat tidak ditemukan'; end if;
  if not (public.is_platform_admin() or public.has_tenant_role(v_item.organization_id, array['MASTER_ADMIN'::text])) then
    raise exception 'role tidak diizinkan membeli stok pusat';
  end if;
  if p_unit_cost is not null then
    if p_unit_cost < 0 then raise exception 'harga beli tidak boleh negatif'; end if;
    update public.cervise_central_items set cost = p_unit_cost, updated_at = now() where id = v_item.id;
  end if;
  return public.apply_central_stock_delta(
    v_item.id, p_qty, p_expected_stock, 'central_purchase',
    public.central_ledger_branch(v_item.organization_id), null);
end;
$$;
revoke all on function public.purchase_central_stock(uuid, integer, integer, integer) from public, anon;
grant execute on function public.purchase_central_stock(uuid, integer, integer, integer) to authenticated;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/central-inventory-migration.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations/20261127140000_central_inventory_rpc.sql src/lib/auth/central-inventory-migration.test.ts
git commit -m "feat(db): RPC item pusat, pembelian, dan ledger stok pusat"
```

---

### Task 4: RPC distribusi, request, approve/tolak, dan tarik kembali

**Files:**
- Create: `supabase/migrations/20261127150000_central_inventory_flows.sql`
- Modify: `src/lib/auth/central-inventory-migration.test.ts`
- Consumes: `apply_central_stock_delta`, `create_central_item`, `purchase_central_stock` dari Task 3; `apply_sparepart_stock_delta` dan `apply_stock_delta` yang whitelist alasannya diperluas di Task 3.

**Interfaces:**
- Produces: `public.distribute_central_stock(p_central_item_id uuid, p_target_branch_id uuid, p_qty integer, p_expected_stock integer default null, p_imei text default null) returns uuid`, `public.request_stock(p_branch_id uuid, p_sku text, p_qty integer) returns uuid`, `public.approve_stock_request(p_request_id uuid, p_decided_qty integer, p_central_item_id uuid default null, p_expected_stock integer default null) returns uuid`, `public.reject_stock_request(p_request_id uuid, p_reason text) returns void`, `public.return_stock_to_central(p_branch_stock_id uuid, p_qty integer) returns integer`.

- [ ] **Step 1: Write the failing test**

```ts
const flows = readFileSync(
  join(process.cwd(), "supabase/migrations/20261127150000_central_inventory_flows.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("central inventory flows rpc", () => {
  it("menolak stok pusat tidak cukup dan request ganda", () => {
    expect(flows).toContain("stok pusat tidak cukup");
    expect(flows).toContain("request sudah menunggu persetujuan");
    expect(flows).toContain("p_decided_qty, p_expected_stock, v_item.imei");
  });

  it("memilih unit IMEI saat approve serialized", () => {
    expect(flows).toContain("v_item.is_serialized");
    expect(flows).toContain("v_item.imei <> p_imei");
  });

  it("mencatat qty keputusan dan alasan penolakan", () => {
    expect(flows).toContain("decided_qty");
    expect(flows).toContain("rejection_reason");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/central-inventory-migration.test.ts -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Isi `20261127150000_central_inventory_flows.sql`. Pola umum:

```sql
create or replace function public.distribute_central_stock(
  p_central_item_id uuid, p_target_branch_id uuid, p_qty integer,
  p_expected_stock integer default null, p_imei text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_item public.cervise_central_items%rowtype;
  v_target public.cervise_spareparts%rowtype;
  v_product public.cervise_products%rowtype;
  v_result uuid;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'jumlah distribusi harus lebih dari nol'; end if;
  select * into v_item from public.cervise_central_items where id = p_central_item_id for update;
  if not found then raise exception 'item pusat tidak ditemukan'; end if;
  if not (public.is_platform_admin() or public.has_tenant_role(v_item.organization_id, array['MASTER_ADMIN'::text])) then
    raise exception 'role tidak diizinkan mendistribusikan stok';
  end if;
  if not exists (select 1 from public.branches where id = p_target_branch_id and organization_id = v_item.organization_id) then
    raise exception 'cabang tujuan tidak ditemukan';
  end if;
  if v_item.is_serialized then
    if p_imei is null or v_item.imei <> p_imei or v_item.stock_qty < 1 then
      raise exception 'unit IMEI tidak tersedia di gudang';
    end if;
  elsif v_item.stock_qty < p_qty then
    raise exception 'stok pusat tidak cukup';
  end if;

  if v_item.kind = 'SPAREPART' then
    insert into public.cervise_spareparts (organization_id, branch_id, central_item_id, sku, name, category, stock_qty, cost, price, is_active)
    values (v_item.organization_id, p_target_branch_id, v_item.id, v_item.sku, v_item.name, v_item.category, 0, v_item.cost, v_item.price, true)
    on conflict (branch_id, sku) do update set central_item_id = excluded.central_item_id, updated_at = now()
    returning id into v_result;
    perform public.apply_sparepart_stock_delta(v_result, p_qty, null, 'distribute', null);
  else
    insert into public.cervise_products (organization_id, branch_id, central_item_id, sku, name, category, stock_qty, cost, price, is_serialized, imei, parent_key, is_active)
    values (v_item.organization_id, p_target_branch_id, v_item.id, v_item.sku, v_item.name, v_item.category, 0, v_item.cost, v_item.price, v_item.is_serialized, v_item.imei, v_item.parent_key, true)
    on conflict (branch_id, sku) do update set central_item_id = excluded.central_item_id, updated_at = now()
    returning id into v_result;
    perform public.apply_stock_delta(v_result, p_qty, null, 'distribute', null, null, null);
  end if;

  perform public.apply_central_stock_delta(v_item.id, -p_qty, p_expected_stock, 'distribute', p_target_branch_id, null);
  return v_result;
end;
$$;
revoke all on function public.distribute_central_stock(uuid, uuid, integer, integer, text) from public, anon;
grant execute on function public.distribute_central_stock(uuid, uuid, integer, integer, text) to authenticated;

create or replace function public.request_stock(p_branch_id uuid, p_sku text, p_qty integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_id uuid;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'jumlah request harus lebih dari nol'; end if;
  select organization_id into v_org from public.branches where id = p_branch_id;
  if v_org is null then raise exception 'cabang tidak ditemukan'; end if;
  if not (public.is_platform_admin() or public.has_tenant_branch_role(v_org, p_branch_id, array['ADMIN','FRONTLINER']::text[])) then
    raise exception 'role tidak diizinkan request stok';
  end if;
  if exists (select 1 from public.cervise_stock_requests where branch_id = p_branch_id and sku = p_sku and status = 'PENDING') then
    raise exception 'request sudah menunggu persetujuan';
  end if;
  insert into public.cervise_stock_requests (organization_id, branch_id, sku, qty, requested_by)
  values (v_org, p_branch_id, trim(p_sku), p_qty, auth.uid()) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.request_stock(uuid, text, integer) from public, anon;
grant execute on function public.request_stock(uuid, text, integer) to authenticated;

create or replace function public.approve_stock_request(
  p_request_id uuid, p_decided_qty integer, p_central_item_id uuid default null, p_expected_stock integer default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.cervise_stock_requests%rowtype; v_item public.cervise_central_items%rowtype; v_branch_stock uuid;
begin
  if p_decided_qty is null or p_decided_qty <= 0 then raise exception 'jumlah persetujuan harus lebih dari nol'; end if;
  select * into v_req from public.cervise_stock_requests where id = p_request_id for update;
  if not found then raise exception 'request tidak ditemukan'; end if;
  if v_req.status <> 'PENDING' then raise exception 'request sudah diproses'; end if;
  if not (public.is_platform_admin() or public.has_tenant_role(v_req.organization_id, array['MASTER_ADMIN'::text])) then
    raise exception 'hanya master admin yang boleh menyetujui request';
  end if;
  if p_decided_qty > v_req.qty then raise exception 'jumlah persetujuan melebihi request'; end if;
  select * into v_item from public.cervise_central_items where id = p_central_item_id for update;
  if not found then raise exception 'item pusat tidak ditemukan'; end if;
  if v_item.sku <> v_req.sku then raise exception 'item tidak sesuai request'; end if;
  if v_item.is_serialized then
    if p_decided_qty <> 1 then raise exception 'unit serialized hanya satu per request'; end if;
  end if;
  -- Baris cabang dibuat/ditambah dulu; stok pusat dipotong terakhir supaya
  -- kegagalan apa pun menggagalkan seluruh transaksi.
  v_branch_stock := public.distribute_central_stock(v_item.id, v_req.branch_id, p_decided_qty, p_expected_stock, v_item.imei);
  update public.cervise_stock_requests
  set status = 'APPROVED', decided_qty = p_decided_qty, central_item_id = v_item.id,
      decided_by = auth.uid(), decided_at = now()
  where id = v_req.id;
  return v_branch_stock;
end;
$$;
revoke all on function public.approve_stock_request(uuid, integer, uuid, integer) from public, anon;
grant execute on function public.approve_stock_request(uuid, integer, uuid, integer) to authenticated;

create or replace function public.reject_stock_request(p_request_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_req public.cervise_stock_requests%rowtype;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'alasan wajib diisi minimal 3 karakter'; end if;
  select * into v_req from public.cervise_stock_requests where id = p_request_id for update;
  if not found then raise exception 'request tidak ditemukan'; end if;
  if v_req.status <> 'PENDING' then raise exception 'request sudah diproses'; end if;
  if not (public.is_platform_admin() or public.has_tenant_role(v_req.organization_id, array['MASTER_ADMIN'::text])) then
    raise exception 'hanya master admin yang boleh menolak request';
  end if;
  update public.cervise_stock_requests
  set status = 'REJECTED', rejection_reason = trim(p_reason), decided_by = auth.uid(), decided_at = now()
  where id = v_req.id;
end;
$$;
revoke all on function public.reject_stock_request(uuid, text) from public, anon;
grant execute on function public.reject_stock_request(uuid, text) to authenticated;

create or replace function public.return_stock_to_central(p_branch_stock_id uuid, p_qty integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v_part public.cervise_spareparts%rowtype; v_prod public.cervise_products%rowtype; v_item_id uuid; v_org uuid; v_branch uuid; v_next integer;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'jumlah pengembalian harus lebih dari nol'; end if;
  select * into v_part from public.cervise_spareparts where id = p_branch_stock_id for update;
  if found then
    v_item_id := v_part.central_item_id; v_org := v_part.organization_id; v_branch := v_part.branch_id;
    if v_part.stock_qty < p_qty then raise exception 'stok cabang tidak cukup'; end if;
    v_next := public.apply_sparepart_stock_delta(v_part.id, -p_qty, null, 'return_to_central', null);
  else
    select * into v_prod from public.cervise_products where id = p_branch_stock_id for update;
    if not found then raise exception 'stok cabang tidak ditemukan'; end if;
    v_item_id := v_prod.central_item_id; v_org := v_prod.organization_id; v_branch := v_prod.branch_id;
    if v_prod.stock_qty < p_qty then raise exception 'stok cabang tidak cukup'; end if;
    v_next := public.apply_stock_delta(v_prod.id, -p_qty, null, 'return_to_central', null, null, null);
  end if;
  if not (public.is_platform_admin() or public.has_tenant_role(v_org, array['MASTER_ADMIN'::text])) then
    raise exception 'hanya master admin yang boleh menarik stok ke pusat';
  end if;
  perform public.apply_central_stock_delta(v_item_id, p_qty, null, 'return_to_central', v_branch, null);
  return v_next;
end;
$$;
revoke all on function public.return_stock_to_central(uuid, integer) from public, anon;
grant execute on function public.return_stock_to_central(uuid, integer) to authenticated;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/central-inventory-migration.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations/20261127150000_central_inventory_flows.sql src/lib/auth/central-inventory-migration.test.ts
git commit -m "feat(db): RPC distribusi, request, approve/tolak, dan pengembalian stok"
```

---

### Task 5: Server actions gudang pusat

**Files:**
- Create: `src/app/app/sparepart/central-actions.ts`
- Test: `src/app/app/sparepart/central-actions.test.ts`
- Consumes: RPC Task 3 & Task 4.

**Interfaces:**
- Produces: `listCentralItems(q: string, kind?: "SPAREPART" | "PRODUCT"): Promise<CentralItemRow[]>`, `createCentralItem(input: CentralItemInput): Promise<string>`, `purchaseCentralStock(input: { id: string; qty: number; unitCost: number; expectedStock: number }): Promise<void>`, `distributeCentralStock(input: { id: string; targetBranchId: string; qty: number; expectedStock: number; imei?: string }): Promise<void>`, `listStockRequests(): Promise<StockRequestRow[]>`, `requestStock(input: { sku: string; qty: number }): Promise<void>`, `approveStockRequest(input: { requestId: string; decidedQty: number; centralItemId: string; expectedStock: number }): Promise<void>`, `rejectStockRequest(input: { requestId: string; reason: string }): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveStockRequest,
  createCentralItem,
  distributeCentralStock,
  requestStock,
} from "./central-actions";

const { mocks } = vi.hoisted(() => {
  const rpc = vi.fn();
  const from = vi.fn();
  const getActiveTenant = vi.fn();
  return { mocks: { rpc, from, getActiveTenant } };
});
vi.mock("@/lib/supabase/actor", () => ({ getActiveTenant: mocks.getActiveTenant }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("central actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.getActiveTenant.mockResolvedValue({
      supabase: { rpc: mocks.rpc, from: mocks.from },
      orgId: "org-1", branchId: "branch-1", role: "ADMIN",
    });
  });

  it("menolak admin cabang membuat item pusat", async () => {
    await expect(createCentralItem({ kind: "SPAREPART", sku: "A", name: "A", category: "Sparepart", stock_qty: 1, cost: 0, price: 0 }))
      .rejects.toThrow("Hanya Master Admin");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("meneruskan expectedStock saat distribusi", async () => {
    mocks.getActiveTenant.mockResolvedValue({
      supabase: { rpc: mocks.rpc, from: mocks.from },
      orgId: "org-1", branchId: "branch-1", role: "MASTER_ADMIN",
    });
    await distributeCentralStock({ id: "item-1", targetBranchId: "branch-2", qty: 2, expectedStock: 9 });
    expect(mocks.rpc).toHaveBeenCalledWith("distribute_central_stock", expect.objectContaining({
      p_central_item_id: "item-1", p_qty: 2, p_expected_stock: 9,
    }));
  });

  it("cabang bisa request tapi tidak bisa approve", async () => {
    await requestStock({ sku: "A", qty: 2 });
    expect(mocks.rpc).toHaveBeenCalledWith("request_stock", expect.objectContaining({ p_qty: 2 }));
    await expect(approveStockRequest({ requestId: "r1", decidedQty: 2, centralItemId: "item-1", expectedStock: 9 }))
      .rejects.toThrow("Hanya Master Admin");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/app/sparepart/central-actions.test.ts -v`
Expected: FAIL — module belum ada.

- [ ] **Step 3: Write minimal implementation**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";
import { numberField } from "./actions-shared";

export type CentralItemRow = {
  id: string; sku: string; name: string; category: string; cost: number; price: number;
  stock_qty: number; is_serialized: boolean; imei: string | null; parent_key: string | null;
  kind: "SPAREPART" | "PRODUCT";
};

export type CentralItemInput = {
  kind: "SPAREPART" | "PRODUCT"; sku: string; name: string; category: string;
  stock_qty: number; cost: number; price: number; imei?: string; parent_key?: string;
};

export type StockRequestRow = {
  id: string; sku: string; qty: number; decided_qty: number | null; status: "PENDING" | "APPROVED" | "REJECTED";
  rejection_reason: string | null; note: string | null; branch_id: string; created_at: string;
};

async function requireMaster() {
  const actor = await getActiveTenant();
  if (actor.role !== "MASTER_ADMIN") throw new Error("Hanya Master Admin");
  return actor;
}

async function requireRequestRole() {
  const actor = await getActiveTenant();
  if (!["MASTER_ADMIN", "ADMIN", "FRONTLINER"].includes(actor.role)) throw new Error("Role tidak diizinkan request stok");
  if (!actor.branchId) throw new Error("Pilih cabang dulu sebelum request stok");
  return actor;
}

export async function listCentralItems(q: string, kind?: "SPAREPART" | "PRODUCT"): Promise<CentralItemRow[]> {
  const actor = await getActiveTenant();
  let query = actor.supabase.from("cervise_central_items").select(
    "id, sku, name, category, cost, price, stock_qty, is_serialized, imei, parent_key, kind, is_active",
  ).eq("organization_id", actor.orgId).eq("is_active", true);
  if (kind) query = query.eq("kind", kind);
  if (q.trim()) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,imei.ilike.%${q}%`);
  const { data, error } = await query.order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCentralItem(input: CentralItemInput): Promise<string> {
  const actor = await requireMaster();
  const sku = input.sku.trim();
  const name = input.name.trim();
  if (!sku || !name) throw new Error("SKU dan nama wajib");
  const { data, error } = await actor.supabase.rpc("create_central_item", {
    p_organization_id: actor.orgId,
    p_kind: input.kind, p_sku: sku, p_name: name,
    p_category: input.category || "Sparepart",
    p_cost: numberField(input.cost, "Modal"), p_price: numberField(input.price, "Harga jual"),
    p_stock_qty: numberField(input.stock_qty, "Stok"),
    p_is_serialized: input.kind === "PRODUCT" && Boolean(input.imei),
    p_imei: input.imei?.trim() || null, p_parent_key: input.parent_key?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
  return data as string;
}

export async function purchaseCentralStock(input: { id: string; qty: number; unitCost: number; expectedStock: number }): Promise<void> {
  const actor = await requireMaster();
  const qty = numberField(input.qty, "Jumlah");
  if (qty <= 0) throw new Error("Jumlah pembelian harus lebih dari nol");
  const { error } = await actor.supabase.rpc("purchase_central_stock", {
    p_central_item_id: input.id, p_qty: qty,
    p_unit_cost: numberField(input.unitCost, "Harga beli"),
    p_expected_stock: numberField(input.expectedStock, "Stok saat ini"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
}

export async function distributeCentralStock(input: { id: string; targetBranchId: string; qty: number; expectedStock: number; imei?: string }): Promise<void> {
  const actor = await requireMaster();
  const qty = numberField(input.qty, "Jumlah");
  if (qty <= 0 || !input.targetBranchId) throw new Error("Pilih cabang tujuan dan jumlah");
  const { error } = await actor.supabase.rpc("distribute_central_stock", {
    p_central_item_id: input.id, p_target_branch_id: input.targetBranchId, p_qty: qty,
    p_expected_stock: numberField(input.expectedStock, "Stok saat ini"),
    p_imei: input.imei ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
}

export async function listStockRequests(): Promise<StockRequestRow[]> {
  const actor = await getActiveTenant();
  const query = actor.role === "MASTER_ADMIN"
    ? actor.supabase.from("cervise_stock_requests").select("*").eq("organization_id", actor.orgId)
    : actor.supabase.from("cervise_stock_requests").select("*").eq("branch_id", actor.branchId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function requestStock(input: { sku: string; qty: number }): Promise<void> {
  const actor = await requireRequestRole();
  const qty = numberField(input.qty, "Jumlah");
  if (qty <= 0 || !input.sku.trim()) throw new Error("Pilih item dan isi jumlah");
  const { error } = await actor.supabase.rpc("request_stock", {
    p_branch_id: actor.branchId, p_sku: input.sku.trim(), p_qty: qty,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
}

export async function approveStockRequest(input: { requestId: string; decidedQty: number; centralItemId: string; expectedStock: number }): Promise<void> {
  const actor = await requireMaster();
  const { error } = await actor.supabase.rpc("approve_stock_request", {
    p_request_id: input.requestId, p_decided_qty: numberField(input.decidedQty, "Jumlah"),
    p_central_item_id: input.centralItemId, p_expected_stock: numberField(input.expectedStock, "Stok saat ini"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
}

export async function rejectStockRequest(input: { requestId: string; reason: string }): Promise<void> {
  const actor = await requireMaster();
  if (input.reason.trim().length < 3) throw new Error("Alasan penolakan minimal 3 karakter");
  const { error } = await actor.supabase.rpc("reject_stock_request", {
    p_request_id: input.requestId, p_reason: input.reason.trim(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
}
```

Buat `src/app/app/sparepart/actions-shared.ts` berisi:

```ts
export function numberField(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${label} harus bilangan bulat >= 0`);
  return n;
}
```

Lalu di `src/app/app/sparepart/actions.ts`, hapus definisi lokal `numberField` dan import dari `./actions-shared`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/app/sparepart/central-actions.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add src/app/app/sparepart/central-actions.ts src/app/app/sparepart/central-actions.test.ts src/app/app/sparepart/actions-shared.ts src/app/app/sparepart/actions.ts
git commit -m "feat(sparepart): server actions gudang pusat dan request stok"
```

---

### Task 6: Batasi tulis cabang & sesuaikan inventori

**Files:**
- Modify: `src/app/app/sparepart/actions.ts`
- Create: `src/app/app/sparepart/actions.test.ts`
- Modify: `src/app/app/inventori/actions.ts`
- Consumes: `numberField` dari `actions-shared.ts` (Task 5).

**Interfaces:**
- Produces: `listSpareparts(q)` kini menggabungkan `cervise_central_items` (semua item tenant) dengan stok `cervise_spareparts` cabang; `createSparepart`/`updateSparepart`/`deleteSparepart`/`setSparepartActive` hanya MASTER_ADMIN; `purchaseSparepartStock` & `transferSparepartStock` dipertahankan untuk kompatibilitas tapi `createSparepart` kini mengarah ke `createCentralItem`.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSparepart, listSpareparts, updateSparepart } from "./actions";

const { mocks } = vi.hoisted(() => {
  const rpc = vi.fn();
  const from = vi.fn();
  const getActiveTenant = vi.fn();
  return { mocks: { rpc, from, getActiveTenant } };
});
vi.mock("@/lib/supabase/actor", () => ({ getActiveTenant: mocks.getActiveTenant }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function chain(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "order", "maybeSingle", "single", "update", "delete", "insert"]) query[m] = vi.fn(() => query);
  query.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

describe("sparepart cabang mengikuti pusat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.getActiveTenant.mockResolvedValue({
      supabase: { rpc: mocks.rpc, from: mocks.from }, orgId: "org-1", branchId: "branch-1", role: "ADMIN",
    });
  });

  it("admin cabang tidak bisa membuat sparepart baru", async () => {
    await expect(createSparepart({ name: "X", category: "Sparepart", stock_qty: 0, cost: 0, price: 0 }))
      .rejects.toThrow("Hanya Master Admin");
  });

  it("admin cabang tidak bisa mengubah harga", async () => {
    await expect(updateSparepart("s1", { name: "X", category: "Sparepart", stock_qty: 0, cost: 0, price: 999 }))
      .rejects.toThrow("Hanya Master Admin");
  });

  it("daftar sparepart cabang berasal dari katalog pusat", async () => {
    const master = { id: "c1", sku: "A", name: "A", category: "Sparepart", cost: 1, price: 2,
      stock_qty: 10, is_serialized: false, imei: null, parent_key: null, is_active: true };
    mocks.from.mockImplementation((table: string) => chain({
      data: table === "cervise_central_items" ? [master] : [{ central_item_id: "c1", stock_qty: 3 }],
      error: null,
    }));
    const rows = await listSpareparts("a");
    expect(mocks.from).toHaveBeenCalledWith("cervise_central_items");
    expect(rows[0]).toMatchObject({ id: "c1", stock_qty: 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/app/sparepart/actions.test.ts -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Di `src/app/app/sparepart/actions.ts`:
- `getManagerActor()` hanya menerima `MASTER_ADMIN` untuk create/update/delete/setActive.
- `listSpareparts(q)` query `cervise_central_items` dengan `eq("organization_id", actor.orgId).eq("kind","SPAREPART").eq("is_active",true)`, lalu query `cervise_spareparts` cabang untuk `stock_qty` per `central_item_id`, gabungkan di JS: `stock_qty` = `branch_stock_qty ?? 0`, `cost`/`price` dari master, `id` = `central_item_id` (id master) supaya UI distribusi/request memakai id pusat.
- `createSparepart(input)` Delegasi ke RPC `create_central_item` (bukan insert langsung): `actor.supabase.rpc("create_central_item", { p_organization_id: actor.orgId, p_kind: "SPAREPART", p_sku: ..., p_name: ..., p_category: ..., p_cost: ..., p_price: ..., p_stock_qty: ... })`.
- `updateSparepart` kini hanya mengubah data master (nama/kategori/modal/harga) lewat RPC `update_central_item` dari Task 3. Stok tidak lagi diubah lewat action ini; hapus pemanggilan `adjust_sparepart_stock` dari `updateSparepart`.

Implementasi `listSpareparts` (bagian yang diubah):

```ts
export async function listSpareparts(q: string): Promise<SparepartRow[]> {
  const actor = await getActiveTenant();
  if (!actor.branchId) return [];
  const term = sanitizeSearchTerm(q);

  const master = actor.supabase
    .from("cervise_central_items")
    .select("id, sku, name, category, cost, price, is_active")
    .eq("organization_id", actor.orgId)
    .eq("kind", "SPAREPART")
    .eq("is_active", true);
  const { data: items, error } = await (term ? master.or(`name.ilike.%${term}%,sku.ilike.%${term}%`) : master).order("name");
  if (error) throw new Error(error.message);

  const { data: branchRows, error: branchError } = await actor.supabase
    .from("cervise_spareparts")
    .select("central_item_id, stock_qty")
    .eq("branch_id", actor.branchId);
  if (branchError) throw new Error(branchError.message);

  const stockById = new Map(
    (branchRows ?? []).map((r) => [r.central_item_id, Number(r.stock_qty ?? 0)]),
  );
  return ((items ?? []) as Omit<SparepartRow, "stock_qty">[]).map((row) => ({
    ...row,
    stock_qty: stockById.get(row.id) ?? 0,
  }));
}
```
- `purchaseSparepartStock` & `transferSparepartStock` tetap ada untuk alur lama. Karena `id` dari `listSpareparts` sekarang adalah id master, resolusi dulu ke baris cabang: `.select("id, stock_qty").eq("central_item_id", input.id).eq("branch_id", actor.branchId).maybeSingle()`; kalau tidak ada, lempar `"Stok cabang belum ada — distribusikan dari pusat dulu"`. `purchaseSparepartStock` lalu memanggil `purchase_central_stock` dengan id master, bukan id baris cabang.

Di `src/app/app/inventori/actions.ts`:
- `updateProductVariant(input)`: hapus `patch.cost`, `patch.price`, `patch.name` dari update cabang; field tersebut kini diedit lewat action pusat. Tetap izinkan `stock_qty`, `storage`, `warna`, `barcode`, `imei`, `bh_percent`, `kondisi_notes`, `garansi_days`, `parent_key` (data fisik cabang).
- `importInventori`: ganti `actor.supabase.from("cervise_products").insert(...)` menjadi loop `actor.supabase.rpc("create_central_item", {... p_kind: "PRODUCT" ...})`; tolak jika `actor.role !== "MASTER_ADMIN"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/app/sparepart/actions.test.ts -v && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add src/app/app/sparepart/actions.ts src/app/app/sparepart/actions.test.ts src/app/app/inventori/actions.ts supabase/migrations/20261127140000_central_inventory_rpc.sql
git commit -m "feat: cabang mengikuti katalog pusat dan tulis dibatasi"
```

---

### Task 7: UI satu halaman dengan scope pusat/cabang

**Files:**
- Modify: `src/app/app/sparepart/page.tsx`
- Modify: `src/app/app/sparepart/sparepart-client.tsx`
- Create: `src/components/sparepart/central-stock-dialogs.tsx`
- Test: `src/app/app/sparepart/central-ui.test.ts`
- Consumes: actions Task 5 & Task 6.

**Interfaces:**
- Produces: `SparepartPage({ canManage, isMasterAdmin })`, komponen `CentralStockDialogs` dengan props `mode: "distribute" | "request" | "approve"`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("halaman sparepart gudang pusat", () => {
  it("menerima flag master admin", () => {
    expect(read("src/app/app/sparepart/page.tsx")).toContain("isMasterAdmin={isMasterAdmin}");
  });

  it("memiliki toggle scope pusat/cabang dan tombol request", () => {
    const ui = read("src/app/app/sparepart/sparepart-client.tsx");
    expect(ui).toContain('value="central"');
    expect(ui).toContain('value="branch"');
    expect(ui).toContain("Request Stok");
    expect(ui).not.toContain("Tambah Sparepart");
  });

  it("hanya master admin yang melihat tab approve", () => {
    const ui = read("src/app/app/sparepart/sparepart-client.tsx");
    expect(ui).toContain("isMasterAdmin &&");
    expect(ui).toContain("Approve Request");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/app/sparepart/central-ui.test.ts -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`src/app/app/sparepart/page.tsx`:

```tsx
import { requireMenu } from "@/lib/auth/require-menu";
import SparepartPage from "./sparepart-client";

export default async function Page() {
  const actor = await requireMenu("kategori_sparepart");
  const canManage = ["MASTER_ADMIN", "ADMIN"].includes(actor.role);
  const isMasterAdmin = actor.role === "MASTER_ADMIN";
  return <SparepartPage canManage={canManage} isMasterAdmin={isMasterAdmin} />;
}
```

`sparepart-client.tsx`:
- Props `{ canManage: boolean; isMasterAdmin: boolean }`.
- State `scope: "central" | "branch"` — default `"central"` untuk master admin, `"branch"` untuk cabang.
- Header actions: toggle scope (`ToggleGroup` atau dua `Button` dengan `variant` aktif), `RefreshDataButton`, dan:
  - scope `central` + master admin: `Tambah Item`, `Beli Stok`, `Distribusi`, `Approve Request`.
  - scope `branch` + `canManage`: `Request Stok`.
  - scope `branch` + master admin: `Distribusi` (memakai dialog yang sama dengan target cabang lain).
- Tabel: kolom Nama, SKU, Kategori, Stok (dari `stock_qty` yang sudah digabung di action), Modal, Harga. Di scope `central`, stok yang ditampilkan adalah stok pusat; di scope `branch`, stok cabang.
- Hapus tombol `Tambah Sparepart` dan `Transfer Stok` lama; distribusi lewat `distributeCentralStock`.
- Render `<CentralStockDialogs mode={...} ... />` untuk distribusi/request/approve; dialog memakai pola `DialogPrimitive` dari `@base-ui/react/dialog` yang sudah dipakai file ini, `sonner` untuk toast, dan `playPageTransition()` setelah aksi sukses.
- `useEffect` reload bergantung pada `[q, branch.id, scope]`.

`src/components/sparepart/central-stock-dialogs.tsx`: satu komponen dengan tiga mode (distribusi: pilih cabang + qty + expectedStock; request: pilih item + qty; approve: pilih item pusat + decidedQty + expectedStock, dengan opsi tolak + alasan). Semua input `inputMode="numeric"`, tombol ≥44px, `aria-label` jelas.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/app/sparepart/central-ui.test.ts -v && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add src/app/app/sparepart/page.tsx src/app/app/sparepart/sparepart-client.tsx src/components/sparepart/central-stock-dialogs.tsx src/app/app/sparepart/central-ui.test.ts
git commit -m "feat(ui): scope gudang pusat dan request stok di halaman sparepart"
```

---

### Task 8: Verifikasi akhir

**Files:** none (verification only)

- [ ] **Step 1: Jalankan seluruh test & static check**

Run: `npm test && npm run typecheck && npm run lint`
Expected: semua PASS, tanpa error baru.

- [ ] **Step 2: Review manual daftar periksa**

- [ ] migrasi dijalankan pada snapshot bersih; total stok sebelum = sesudah; semua cabang stok 0.
- [ ] master admin tambah item → tampil di pusat, bukan di cabang.
- [ ] distribusi → stok pusat turun, stok cabang naik, dua baris ledger `distribute` dengan `is_central_side`.
- [ ] request cabang → `PENDING`, stok belum berubah; approve → stok berubah; tolak → stok tidak berubah.
- [ ] unit IMEI ganda ditolak.
- [ ] cabang tidak melihat angka stok pusat; technician hanya lihat.
- [ ] servis & POS cabang masih bisa memakai stok hasil distribusi.

- [ ] **Step 3: Commit jika ada perbaikan kecil**

```powershell
git add -A
git commit -m "fix: perbaikan akhir gudang pusat"
```
