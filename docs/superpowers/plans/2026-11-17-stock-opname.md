# Stock Opname Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build session-based stock opname for Products and Spareparts at `/app/inventori/opname` with draft counting, variance review, admin-only posting through the existing stock ledger, history, and XLSX export.

**Architecture:** Pure helpers in `src/lib/operational/stock-opname.ts` compute snapshots/variances/summaries; server actions load/save/post sessions using a new branch-scoped `post_stock_opname` RPC that reuses `apply_stock_delta(..., 'stock_adjust', p_notes)`; UI is shadcn base with coss number-field/drawer/progress accents, mobile-first with no horizontal scroll.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase RPC/RLS, shadcn (base-nova, Base UI), coss registry, `xlsx` (already installed), vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-stock-opname-design.md`

## Global Constraints

- Domain sessions are separate: `domain = "product" | "sparepart"`; never mix in one session.
- Route: `/app/inventori/opname` with tabs **Produk | Sparepart**; linked from Inventori header.
- Posting requires `MASTER_ADMIN` or `ADMIN`; frontliner/technician may create/count drafts only.
- BEKAS with IMEI counted per unit/IMEI; BARU and sparepart counted per `stock_qty`.
- Reuse `cervise_stock_movements` (`reason = 'stock_adjust'`); no new ledger table, no new dependency.
- UI: shadcn base, coss accents (`number-field`, `drawer`, `progress`), sonner toast; no horizontal scroll on mobile; 44px touch targets; token-based colors; respect reduced motion.
- XLSX export via existing `xlsx`; no per-line photo.

## Review Focus

- Double posting of a DRAFT session → `post_stock_opname` locks row and rejects non-DRAFT.
- Stale snapshot concurrency → `p_expected_stock` rejects if stock changed since count.
- Unauthorized posting → server action and RPC both check role; technician/frontliner never post.
- BEKAS IMEI unit missing → delta −1 per unit; unknown IMEI found → +1, aggregated to product row for posting.
- Mobile count screen horizontal overflow → flex lists with `min-w-0`, table only at `sm:`; XLSX export works for both DRAFT and POSTED.

---

### Task 1: Database schema and posting RPC

**Files:**
- Create: `supabase/migrations/20261117120000_stock_opname.sql`
- Modify: none

**Interfaces:**
- Produces: tables `cervise_stock_opname_sessions`, `cervise_stock_opname_lines`; RPC `post_stock_opname(p_session_id uuid) returns integer`; extended `apply_stock_delta`/`adjust_product_stock` with optional `p_notes text default null`.

- [ ] **Step 1: Write migration with tables, RLS, and p_notes extension**

```sql
create table if not exists public.cervise_stock_opname_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  domain text not null check (domain in ('product','sparepart')),
  status text not null default 'DRAFT' check (status in ('DRAFT','POSTED','CANCELLED')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  posted_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.cervise_stock_opname_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cervise_stock_opname_sessions(id) on delete cascade,
  ref_id uuid not null,
  sku text,
  name text,
  imei text,
  snapshot_qty integer not null,
  counted_qty integer not null default 0,
  notes text,
  counted_by uuid references public.profiles(id) on delete set null,
  counted_at timestamptz,
  unique (session_id, ref_id, imei)
);

alter table public.cervise_stock_opname_sessions enable row level security;
alter table public.cervise_stock_opname_lines enable row level security;
-- branch-scoped select/insert/update policies using public.has_tenant_branch_role(...)
-- matching the existing 20260925150000 migration pattern.
```

- [ ] **Step 2: Add optional `p_notes` to `apply_stock_delta` and `adjust_product_stock`**

Verbatim pattern from `20260925150000_service_spareparts_status.sql:110-170` and `:177-211`: re-create both functions with an extra trailing `p_notes text default null`, pass `p_notes` into the `insert into public.cervise_stock_movements (... notes ...)`, drop old signatures, re-grant `execute` to `authenticated`.

- [ ] **Step 3: Add `post_stock_opname` RPC**

```sql
create or replace function public.post_stock_opname(p_session_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_session public.cervise_stock_opname_sessions%rowtype;
  v_line record;
  v_count integer := 0;
  v_delta integer;
begin
  select * into v_session from public.cervise_stock_opname_sessions where id = p_session_id for update;
  if not found then raise exception 'Sesi tidak ditemukan'; end if;
  if not public.has_tenant_branch_role(v_session.organization_id, v_session.branch_id, array['MASTER_ADMIN','ADMIN']) then
    raise exception 'Hanya admin yang boleh memposting opname';
  end if;
  if v_session.status <> 'DRAFT' then raise exception 'Sesi sudah diposting/dibatalkan'; end if;

  for v_line in select * from public.cervise_stock_opname_lines where session_id = p_session_id loop
    v_delta := v_line.counted_qty - v_line.snapshot_qty;
    if v_delta <> 0 then
      perform public.apply_stock_delta(
        v_line.ref_id, v_delta, v_line.snapshot_qty, 'stock_adjust', null, null,
        'opname:' || p_session_id || ':' || v_line.id
      );
      v_count := v_count + 1;
    end if;
  end loop;

  update public.cervise_stock_opname_sessions
    set status = 'POSTED', posted_at = now(), posted_by = auth.uid()
    where id = p_session_id;
  return v_count;
end; $$;
```

- [ ] **Step 4: Verify migration syntax**

Run: `npx supabase db reset --local` (if local stack available), otherwise inspect SQL manually.
Expected: no syntax errors; functions granted to `authenticated`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261117120000_stock_opname.sql
git commit -m "feat(db): add stock opname sessions/lines and post RPC"
```

### Task 2: Pure opname helpers with tests

**Files:**
- Create: `src/lib/operational/stock-opname.ts`
- Create: `src/lib/operational/stock-opname.test.ts`

**Interfaces:**
- Consumes: `InventoryProduct`, `SparepartRow` shapes.
- Produces: `buildProductSnapshot(products: InventoryProduct[]): OpnameLineDraft[]`, `buildSparepartSnapshot(rows: SparepartRow[]): OpnameLineDraft[]`, `computeVariance(line): number`, `summarize(lines): OpnameSummary`, `toXlsxRows(lines, session): object[]`.

- [ ] **Step 1: Write failing tests**

```ts
import { buildProductSnapshot, computeVariance, summarize } from "./stock-opname";

it("makes one line per IMEI for BEKAS and one aggregate line for BARU", () => {
  const lines = buildProductSnapshot([
    { id: "b1", name: "HP", sku: "S1", stock_qty: 2, variant_type: "BEKAS", imei: "111", category: null, cost: 100, price: 200, storage: null, warna: null, bh_percent: null, kondisi_notes: null, garansi_days: null, parent_key: null },
    { id: "b2", name: "HP", sku: "S1", stock_qty: 2, variant_type: "BEKAS", imei: "222", category: null, cost: 100, price: 200, storage: null, warna: null, bh_percent: null, kondisi_notes: null, garansi_days: null, parent_key: null },
    { id: "n1", name: "Kabel", sku: "S2", stock_qty: 5, variant_type: "BARU", imei: null, category: null, cost: 10, price: 20, storage: null, warna: null, bh_percent: null, kondisi_notes: null, garansi_days: null, parent_key: null },
  ]);
  expect(lines.filter((l) => l.imei)).toHaveLength(2);
  expect(lines.find((l) => l.refId === "n1")?.snapshotQty).toBe(5);
});

it("computes variance and summary", () => {
  const lines = [
    { refId: "a", name: "A", snapshotQty: 5, countedQty: 3, cost: 10 },
    { refId: "b", name: "B", snapshotQty: 2, countedQty: 4, cost: 7 },
  ];
  expect(computeVariance(lines[0])).toBe(-2);
  const s = summarize(lines);
  expect(s.shortage).toBe(1);
  expect(s.surplus).toBe(1);
  expect(s.varianceValue).toBe(-6); // (-2*10)+(+2*7)
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/operational/stock-opname.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement helpers**

```ts
export type OpnameLineDraft = {
  refId: string; sku: string; name: string; imei: string | null;
  snapshotQty: number; countedQty: number; cost: number;
};
export function computeVariance(l: Pick<OpnameLineDraft,"snapshotQty"|"countedQty">): number {
  return l.countedQty - l.snapshotQty;
}
export function buildProductSnapshot(products: InventoryProduct[]): OpnameLineDraft[] {
  const out: OpnameLineDraft[] = [];
  for (const p of products) {
    const common = { sku: p.sku, name: p.name, cost: p.cost ?? 0 };
    if (p.variant_type === "BEKAS" && p.imei) {
      out.push({ ...common, refId: p.id, imei: p.imei, snapshotQty: 1, countedQty: 0 });
    } else {
      out.push({ ...common, refId: p.id, imei: null, snapshotQty: p.stock_qty ?? 0, countedQty: 0 });
    }
  }
  return out;
}

export function buildSparepartSnapshot(rows: SparepartRow[]): OpnameLineDraft[] {
  return rows.map((r) => ({
    refId: r.id, sku: r.sku, name: r.name, imei: null,
    snapshotQty: r.stock_qty, countedQty: 0, cost: r.cost,
  }));
}

export function summarize(lines: OpnameLineDraft[]) {
  let counted = 0, matched = 0, shortage = 0, surplus = 0, varianceValue = 0;
  for (const line of lines) {
    if (line.countedQty > 0) counted++;
    const delta = computeVariance(line);
    if (delta === 0) matched++;
    else if (delta < 0) shortage++;
    else surplus++;
    varianceValue += delta * line.cost;
  }
  return { total: lines.length, counted, matched, shortage, surplus, varianceValue };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/operational/stock-opname.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/operational/stock-opname.ts src/lib/operational/stock-opname.test.ts
git commit -m "feat: add pure stock opname snapshot and variance helpers"
```

### Task 3: Server actions (create/count/post/history/export data)

**Files:**
- Create: `src/app/app/inventori/opname/actions.ts`
- Test: `src/app/app/inventori/opname/actions.test.ts` (source-level wiring checks, same style as `sound-wiring.test.ts`)

**Interfaces:**
- Consumes: `OpnameLineDraft`, `post_stock_opname` RPC.
- Produces: `listSessions(domain)`, `createSession(domain, note)`, `getSession(id)`, `saveCount(id, refId, imei, countedQty)`, `postSession(id)`, `cancelSession(id)`.

- [ ] **Step 1: Write failing wiring test**

```ts
const actions = read("src/app/app/inventori/opname/actions.ts");
it("gates posting to admin and uses the atomic RPC", () => {
  expect(actions).toContain('MASTER_ADMIN');
  expect(actions).toContain("rpc(\"post_stock_opname\"");
  expect(actions).toContain("revalidatePath('/app/inventori/opname')");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/app/app/inventori/opname/actions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement actions**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/supabase/actor";

async function actor() {
  const a = await getActiveTenant();
  if (!a.branchId) throw new Error("Pilih cabang dulu");
  return a;
}
async function manager() {
  const a = await actor();
  if (!["MASTER_ADMIN", "ADMIN"].includes(a.role)) throw new Error("Hanya admin yang boleh memposting opname");
  return a;
}

export async function createSession(domain: "product" | "sparepart", note: string) { /* actor(), insert session with snapshot lines from helpers */ }
export async function saveCount(sessionId: string, refId: string, imei: string | null, countedQty: number) { /* actor(), update line only if session DRAFT */ }
export async function postSession(id: string) { await manager(); const a = await actor(); await a.supabase.rpc("post_stock_opname", { p_session_id: id }); revalidatePath("/app/inventori/opname"); }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/app/app/inventori/opname/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/inventori/opname/actions.ts src/app/app/inventori/opname/actions.test.ts
git commit -m "feat: add stock opname server actions with admin-only posting"
```

### Task 4: UI — page, tabs, count panel, review dialog, export

**Files:**
- Create: `src/app/app/inventori/opname/page.tsx`
- Create: `src/app/app/inventori/opname/opname-client.tsx`
- Create: `src/components/inventori/opname-count-panel.tsx`
- Create: `src/components/inventori/opname-review-dialog.tsx`
- Create: `src/components/inventori/opname-export.tsx`
- Modify: `src/components/inventori/inventori-header-actions.tsx` (link to `/app/inventori/opname`)
- Install: `npx shadcn@latest add @coss/number-field @coss/drawer @coss/progress`

**Interfaces:**
- Consumes: all Task 3 actions, Task 2 helpers.
- Produces: working opname page with domain tabs.

- [ ] **Step 1: Install coss primitives**

Run: `npx shadcn@latest add @coss/number-field @coss/drawer @coss/progress`
Expected: files added under `src/components/ui/`; read each and fix imports to project aliases (`@/components/ui/...`, lucide icons) per shadcn skill.

- [ ] **Step 2: Build server page**

```tsx
// page.tsx
import { listSessions } from "./actions";
import { OpnameClient } from "./opname-client";
export default async function OpnamePage() {
  const [products, spareparts] = await Promise.all([listSessions("product"), listSessions("sparepart")]);
  return <OpnameClient products={products} spareparts={spareparts} />;
}
```

- [ ] **Step 3: Build client with tabs and count panel**

Use shadcn `Tabs` with `TabsList`/`TabsTrigger` for **Produk | Sparepart**; `BentoCard`-like responsive cards (flex-col, `min-w-0`, `truncate`) on mobile and shadcn `Table` with `aria-sort` on `sm:`; `ToggleGroup` for filter (belum/cocok/selisih); `NumberField` for qty with `inputMode="numeric"`; `Progress` for count completion; sticky footer with `pb-[env(safe-area-inset-bottom)]`. Reuse `BarcodeScannerDialog` for scan/IMEI entry. `Badge` + `+/-` icon for variance; color never the only signal.

- [ ] **Step 4: Build review dialog and export**

`opname-review-dialog.tsx`: shadcn `Dialog` + `Alert` for shortages + `AlertDialog` confirm before posting; `postSession` called only for admin role. `opname-export.tsx`: `XLSX.utils.json_to_sheet` + `XLSX.writeFile` with two sheets (Ringkasan, Baris) from `toXlsxRows`, filename `opname-<domain>-<date>.xlsx`.

- [ ] **Step 5: Add Inventori header link**

In `inventori-header-actions.tsx`, add a `Button asChild` / `Link` to `/app/inventori/opname` labeled "Stock Opname" with `PackageCheckIcon` and `data-icon="inline-start"`.

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npx vitest run src/lib/operational/stock-opname.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/app/inventori/opname src/components/inventori/opname-*.tsx src/components/inventori/inventori-header-actions.tsx
git commit -m "feat: add stock opname UI with tabs, count, review, and export"
```

### Task 5: Final verification

- [ ] **Step 1:** `npm run typecheck`, `npm run lint`, `npm run test`.
- [ ] **Step 2:** Manual checklist: create session → count → review → post → verify `cervise_stock_movements` row with `notes='opname:...'`; retry post (must reject); frontliner/technician cannot post; mobile 375px no horizontal scroll; XLSX export downloads.
- [ ] **Step 3:** Commit any fixes.
