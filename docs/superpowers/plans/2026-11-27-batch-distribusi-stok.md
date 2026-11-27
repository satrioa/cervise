# Batch Distribusi Stok Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Master admin bisa mendistribusikan beberapa item gudang pusat ke satu cabang sekaligus lewat tabel qty inline + preview, dengan satu transaksi atomik.

**Architecture:** RPC batch baru `distribute_central_items_batch` memanggil `distribute_central_stock` per baris dalam satu transaksi; server action meneruskan array item + `expected_stock`; dialog distribusi menjadi dua langkah (draft → preview). Item serialized tetap memakai alur lama.

**Tech Stack:** Next.js 16.3.6, Supabase Postgres/PLpgSQL, React 19 client dialog (`@base-ui/react/dialog`), shadcn/Base UI table, Vitest 3, TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-27-batch-distribusi-stok-design.md`

## Global Constraints
- Jalankan `npm test`, `npm run typecheck`, dan ESLint pada file yang disentuh sebelum selesai.
- Ikuti pola test repo: migration & UI memakai string-assertion (`readFileSync` + flatten/lowercase untuk SQL); action memakai `vi.hoisted` + `vi.mock("@/lib/supabase/actor")` + `vi.mock("next/cache")`.
- Semua penulisan stok tetap lewat RPC `security definer`; validasi role ada di database, bukan hanya UI.
- Batch **atomik**: satu baris gagal → tidak ada stok yang berpindah; pesan error menyertakan SKU.
- Batch hanya item non-serial; serialized tetap pakai `distributeCentralStock` satu-per-satu.
- Ui state: `draft` → `preview` → `saving` → `done`/`error`; preview punya tombol **Kembali**.
- Tanpa dependency baru; jangan mengubah ledger, helper stok, atau tabel master.
- Bekerja di `C:\Users\ASUS\Documents\Project\New RBM\cervise` pada `main`. Dua file hasil perbaikan toolbar mobile (`src/components/layout/page-header.tsx`, `src/components/layout/page-header.test.ts`) masih modified milik sesi sebelumnya — **jangan disentuh atau di-commit** oleh task-task di bawah. Jangan pakai `git add -A` / `git commit -a`.

## Review Focus
- **Gagal di tengah batch** → tidak ada distribusi sebagian; test: Task 1 assertion `for ... jsonb_array_elements` + re-raise dengan SKU (`'%: %', v_sku, sqlerrm`).
- **`expected_stock` basi antara preview dan submit** → seluruh batch ditolak; test: Task 1 assertion `v_expected := (v_item ->> 'expected_stock')::integer`, Task 2 assertion tiap item membawa `expected_stock`.
- **SKU dobel di daftar** → ditolak saat ditambahkan; test: Task 3 assertion pesan "sudah ada di daftar" di dialog.
- **Item serialized masuk batch** → tidak boleh, tapi jalur single-unit tetap ada; test: Task 3 assertion filter `!item.is_serialized` + mode `distribute-serial`, dan Task 1 assertion argumen terakhir `null` pada `perform public.distribute_central_stock(...)`.
- **Dialog melebar / tombol aksi tertutup di mobile** → tabel scroll internal, footer tidak ikut scroll; test: Task 3 assertion `overflow-x-auto`, `max-h-[90vh]`, `min-w-[420px]`, footer `shrink-0`, dan `saving` menonaktifkan Konfirmasi.

---

### Task 1: RPC batch distribusi

**Files:**
- Create: `supabase/migrations/20261127200000_batch_distribution.sql`
- Modify: `src/lib/auth/central-inventory-migration.test.ts`

**Interfaces:**
- Produces: `public.distribute_central_items_batch(p_target_branch_id uuid, p_items jsonb) returns jsonb` dengan `p_items = [{central_item_id, qty, expected_stock}]`, return `{lines, total_qty}`.

- [ ] **Step 1: Write the failing test**

Tambahkan ke `src/lib/auth/central-inventory-migration.test.ts`:

```ts
const batch = readFileSync(
  join(process.cwd(), "supabase/migrations/20261127200000_batch_distribution.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("batch distribution rpc", () => {
  it("memproses semua baris dalam satu fungsi dan atomik", () => {
    expect(batch).toContain("create or replace function public.distribute_central_items_batch");
    expect(batch).toContain("for v_item in select * from jsonb_array_elements(p_items)");
    expect(batch).toContain("perform public.distribute_central_stock(");
    expect(batch).toContain("raise exception '%: %', v_sku, sqlerrm");
  });

  it("hanya master admin tenant yang boleh memanggil", () => {
    expect(batch).toContain("array['master_admin'::text]");
    expect(batch).toContain("revoke all on function public.distribute_central_items_batch(uuid, jsonb) from public, anon");
    expect(batch).toContain("grant execute on function public.distribute_central_items_batch(uuid, jsonb) to authenticated");
  });

  it("meneruskan expected_stock tiap baris dan menolak array kosong", () => {
    expect(batch).toContain("v_expected := (v_item ->> 'expected_stock')::integer");
    expect(batch).toContain("v_central_item_id, p_target_branch_id, v_qty, v_expected, null");
    expect(batch).toContain("pilih minimal satu item");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/central-inventory-migration.test.ts -v`
Expected: FAIL (file migration belum ada).

- [ ] **Step 3: Write minimal implementation**

Isi `20261127200000_batch_distribution.sql`:

```sql
-- Satu transaksi untuk seluruh daftar distribusi.
create or replace function public.distribute_central_items_batch(
  p_target_branch_id uuid, p_items jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_central_item_id uuid;
  v_qty integer;
  v_expected integer;
  v_sku text;
  v_lines integer := 0;
  v_total integer := 0;
begin
  if not (
    public.is_platform_admin()
    or exists (
      select 1 from public.branches b
      where b.id = p_target_branch_id
        and public.has_tenant_role(b.organization_id, array['MASTER_ADMIN'::text])
    )
  ) then
    raise exception 'hanya master admin yang boleh mendistribusikan stok';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'pilih minimal satu item';
  end if;
  if not exists (select 1 from public.branches where id = p_target_branch_id) then
    raise exception 'cabang tujuan tidak ditemukan';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_central_item_id := (v_item ->> 'central_item_id')::uuid;
    v_qty := (v_item ->> 'qty')::integer;
    v_expected := (v_item ->> 'expected_stock')::integer;
    if v_central_item_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'baris distribusi tidak valid';
    end if;
    select sku into v_sku from public.cervise_central_items where id = v_central_item_id;
    if v_sku is null then raise exception 'item pusat tidak ditemukan'; end if;
    if v_expected is null then raise exception '%: expected_stock wajib', v_sku; end if;
    begin
      perform public.distribute_central_stock(v_central_item_id, p_target_branch_id, v_qty, v_expected, null);
    exception when others then
      raise exception '%: %', v_sku, sqlerrm;
    end;
    v_lines := v_lines + 1;
    v_total := v_total + v_qty;
  end loop;

  return jsonb_build_object('lines', v_lines, 'total_qty', v_total);
end;
$$;
revoke all on function public.distribute_central_items_batch(uuid, jsonb) from public, anon;
grant execute on function public.distribute_central_items_batch(uuid, jsonb) to authenticated;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/central-inventory-migration.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations/20261127200000_batch_distribution.sql src/lib/auth/central-inventory-migration.test.ts
git commit -m "feat(db): RPC batch distribusi atomik per cabang"
```

---

### Task 2: Server action batch

**Files:**
- Modify: `src/app/app/sparepart/central-actions.ts`
- Modify: `src/app/app/sparepart/central-actions.test.ts`
- Consumes: RPC dari Task 1.

**Interfaces:**
- Produces: `distributeCentralItemsBatch(input: { targetBranchId: string; items: Array<{ id: string; qty: number; expectedStock: number }> }): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Tambahkan ke `central-actions.test.ts`:

```ts
import { revalidatePath } from "next/cache";

it("menolak batch kosong sebelum memanggil RPC", async () => {
  asMaster();
  await expect(distributeCentralItemsBatch({ targetBranchId: "branch-2", items: [] }))
    .rejects.toThrow("Pilih minimal satu item");
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("meneruskan array item beserta expected_stock", async () => {
  asMaster();
  await distributeCentralItemsBatch({
    targetBranchId: "branch-2",
    items: [
      { id: "item-1", qty: 2, expectedStock: 9 },
      { id: "item-2", qty: 3, expectedStock: 5 },
    ],
  });
  expect(mocks.rpc).toHaveBeenCalledWith("distribute_central_items_batch", {
    p_target_branch_id: "branch-2",
    p_items: [
      { central_item_id: "item-1", qty: 2, expected_stock: 9 },
      { central_item_id: "item-2", qty: 3, expected_stock: 5 },
    ],
  });
  expect(revalidatePath).toHaveBeenCalledTimes(1);
});

it("meneruskan error RPC apa adanya", async () => {
  asMaster();
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Baterai: stok berubah" } });
  await expect(distributeCentralItemsBatch({
    targetBranchId: "branch-2", items: [{ id: "item-1", qty: 1, expectedStock: 9 }],
  })).rejects.toThrow("Baterai: stok berubah");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/app/sparepart/central-actions.test.ts -v`
Expected: FAIL (`distributeCentralItemsBatch` belum diekspor).

- [ ] **Step 3: Write minimal implementation**

Tambahkan ke `src/app/app/sparepart/central-actions.ts` setelah `distributeCentralStock`:

```ts
export type BatchDistributeInput = {
  targetBranchId: string;
  items: Array<{ id: string; qty: number; expectedStock: number }>;
};

export async function distributeCentralItemsBatch(input: BatchDistributeInput): Promise<void> {
  const actor = await requireMaster();
  if (!input.targetBranchId || input.targetBranchId === "all") throw new Error("Pilih cabang tujuan");
  if (!Array.isArray(input.items) || input.items.length === 0) throw new Error("Pilih minimal satu item");

  const items = input.items.map((item) => {
    const qty = numberField(item.qty, "Jumlah");
    const expectedStock = numberField(item.expectedStock, "Stok saat ini");
    if (qty <= 0) throw new Error("Jumlah harus lebih dari nol");
    return { central_item_id: item.id, qty, expected_stock: expectedStock };
  });

  const { error } = await actor.supabase.rpc("distribute_central_items_batch", {
    p_target_branch_id: input.targetBranchId,
    p_items: items,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/sparepart");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/app/sparepart/central-actions.test.ts -v && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/app/sparepart/central-actions.ts src/app/app/sparepart/central-actions.test.ts
git commit -m "feat(sparepart): server action batch distribusi"
```

---

### Task 3: Dialog distribusi dua langkah

**Files:**
- Modify: `src/components/sparepart/central-stock-dialogs.tsx`
- Modify: `src/app/app/sparepart/sparepart-client.tsx`
- Modify: `src/app/app/sparepart/central-ui.test.ts`
- Consumes: `distributeCentralItemsBatch` dari Task 2, `CentralItemRow`, `Branch`.

**Interfaces:**
- `CentralStockDialogs` menerima prop baru `onReload: () => void` (reload daftar tanpa menutup dialog). `onDone` tetap dipakai saat sukses.
- Mode `distribute` memakai state `preview: boolean`; `request`/`approve` tidak berubah.

- [ ] **Step 1: Write the failing test**

Tambahkan ke `central-ui.test.ts`:

```ts
it("dialog distribusi mendukung batch, preview, dan tabel yang tidak melebar", () => {
  const dlg = read("src/components/sparepart/central-stock-dialogs.tsx");
  expect(dlg).toContain("distributeCentralItemsBatch");
  expect(dlg).toContain("max-h-[90vh]");
  expect(dlg).toContain("overflow-y-auto");
  expect(dlg).toContain("overflow-x-auto");
  expect(dlg).toContain("min-w-[420px]");
  expect(dlg).toContain("Lanjut ke Preview");
  expect(dlg).toContain("Kembali");
  expect(dlg).toContain("Konfirmasi");
  expect(dlg).toContain("!item.is_serialized");
  expect(dlg).toContain("Stok gudang");
  expect(dlg).toContain("Item ini sudah ada di daftar");
  expect(dlg).toContain("onClick={confirmBatch}");
  expect(dlg).toContain("disabled={saving}");
});

it("unit serialized tetap punya dialog distribusi tersendiri", () => {
  const dlg = read("src/components/sparepart/central-stock-dialogs.tsx");
  expect(dlg).toContain('"distribute-serial"');
  expect(dlg).toContain("Distribusi Unit Serial");
  expect(read("src/app/app/sparepart/sparepart-client.tsx")).toContain("Distribusi Unit (IMEI)");
});

it("batch gagal me-reload daftar tanpa menutup dialog", () => {
  expect(read("src/components/sparepart/central-stock-dialogs.tsx")).toContain("onReload()");
  expect(read("src/app/app/sparepart/sparepart-client.tsx")).toContain("onReload={() => void reload()}");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/app/sparepart/central-ui.test.ts -v`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Di `central-stock-dialogs.tsx`:
- Import `distributeCentralItemsBatch` dari `@/app/app/sparepart/central-actions`, `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` dari `@/components/ui/table`.
- Tambah prop `onReload: () => void`.
- Tambah state:

```ts
type BatchRow = { id: string; sku: string; name: string; stock_qty: number; qty: string };
const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
const [preview, setPreview] = useState(false);

const batchItems = items.filter((item) => !item.is_serialized);
const validRows = batchRows.filter((row) => {
  const n = Number(row.qty);
  return Number.isInteger(n) && n > 0 && n <= row.stock_qty;
});

const addBatchRow = () => {
  const picked = items.find((item) => item.id === itemId);
  if (!picked || picked.is_serialized) {
    toast.error("Pilih item non-serial dulu");
    return;
  }
  if (batchRows.some((row) => row.sku === picked.sku)) {
    toast.error("Item ini sudah ada di daftar");
    return;
  }
  setBatchRows((rows) => [...rows, {
    id: picked.id, sku: picked.sku, name: picked.name,
    stock_qty: picked.stock_qty, qty: "1",
  }]);
  setItemId("");
};
```

- Handler submit (dipakai tombol Konfirmasi di preview):

```ts
const confirmBatch = async () => {
  if (!target || validRows.length !== batchRows.length) {
    toast.error("Periksa cabang tujuan dan qty tiap baris");
    return;
  }
  setSaving(true);
  try {
    await distributeCentralItemsBatch({
      targetBranchId: target,
      items: validRows.map((row) => ({
        id: row.id, qty: Number(row.qty), expectedStock: row.stock_qty,
      })),
    });
    playPageTransition();
    toast.success(`${validRows.length} item didistribusikan`);
    onDone();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Gagal mendistribusikan");
    onReload();
    setPreview(false);
  } finally {
    setSaving(false);
  }
};
```

- Jalur serialized tetap ada: ubah `type Mode = "distribute" | "distribute-serial" | "request" | "approve"`, tambah `TITLES["distribute-serial"] = "Distribusi Unit Serial"`; di `handleStock`, syarat alur lama menjadi `if (mode === "distribute-serial")`, dan select item untuk mode ini memakai `items` (tanpa filter `!is_serialized`). Deskripsi dialog untuk `distribute`/`distribute-serial` tetap "Stok pusat berkurang dan stok cabang tujuan bertambah."
- Di `sparepart-client.tsx`, tombol master admin di scope `central` tambah: `<Button variant="outline" size="sm" className="h-8" onClick={() => setDialogMode("distribute-serial")}><TruckIcon className="size-3.5" /> Distribusi Unit (IMEI)</Button>`. Tombol batch "Distribusi" tetap membuka `mode="distribute"`.

- Popup: `className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[95vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-6 shadow-lg"`; area isi `className="mt-4 min-h-0 flex-1 overflow-y-auto space-y-3"`; footer `className="mt-5 flex shrink-0 flex-wrap justify-end gap-2"`.
- Untuk `mode === "distribute"`, di area isi saat `!preview`: select cabang tujuan tetap di atas; select item memakai `batchItems`; tombol "Tambah" memanggil `addBatchRow`; lalu tabel:

```tsx
<div className="overflow-x-auto rounded-md border">
  <Table className="min-w-[420px]">
    <TableHeader>
      <TableRow>
        <TableHead>Nama item</TableHead>
        <TableHead className="text-right">Stok gudang</TableHead>
        <TableHead>Qty</TableHead>
        <TableHead><span className="sr-only">Hapus</span></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {batchRows.map((row) => (
        <TableRow key={row.id}>
          <TableCell><div className="font-medium">{row.name}</div><div className="font-mono text-xs">{row.sku}</div></TableCell>
          <TableCell className="text-right tabular-nums">{row.stock_qty}</TableCell>
          <TableCell>
            <Input type="number" min={1} max={row.stock_qty} inputMode="numeric"
              aria-label={`Qty ${row.sku}`} className="min-h-11 w-20"
              value={row.qty}
              onChange={(e) => setBatchRows((rows) => rows.map((r) => r.id === row.id ? { ...r, qty: e.target.value } : r))} />
          </TableCell>
          <TableCell>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Hapus ${row.sku}`}
              onClick={() => setBatchRows((rows) => rows.filter((r) => r.id !== row.id))}>
              <XIcon className="size-4" />
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
<p className="text-xs text-muted-foreground">{batchRows.length} item · {validRows.reduce((n, r) => n + Number(r.qty), 0)} unit</p>
<Button type="button" className="min-h-11" disabled={!target || validRows.length === 0 || validRows.length !== batchRows.length}
  onClick={() => setPreview(true)}>Lanjut ke Preview</Button>
```

- Saat `preview === true`, ganti isi dialog dengan ringkasan baca-saja:

```tsx
<p className="text-sm">Cabang tujuan: {branches.find((b) => b.id === target)?.label}</p>
<div className="overflow-x-auto rounded-md border">
  <Table className="min-w-[420px]">
    <TableHeader><TableRow>
      <TableHead>Nama item</TableHead><TableHead className="text-right">Stok sebelum → sesudah</TableHead>
      <TableHead className="text-right">Qty</TableHead>
    </TableRow></TableHeader>
    <TableBody>
      {validRows.map((row) => (
        <TableRow key={row.id}>
          <TableCell>{row.name} <span className="font-mono text-xs">{row.sku}</span></TableCell>
          <TableCell className="text-right tabular-nums">{row.stock_qty} → {row.stock_qty - Number(row.qty)}</TableCell>
          <TableCell className="text-right tabular-nums">{row.qty}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
<p className="text-sm text-muted-foreground">{validRows.length} item · {validRows.reduce((n, r) => n + Number(r.qty), 0)} unit</p>
```

- Footer (di dalam `<div className="mt-5 flex shrink-0 flex-wrap justify-end gap-2">`): untuk `mode === "distribute"` pakai cabang ini — preview tampilkan **Kembali** (`onClick={() => setPreview(false)}`, `disabled={saving}`) dan **Konfirmasi** (`onClick={confirmBatch}`, `disabled={saving}`); draft tampilkan **Batal** dan **Lanjut ke Preview** (`disabled={!target || validRows.length === 0 || validRows.length !== batchRows.length}`). Untuk `distribute-serial`/`request`/`approve`, footer lama tidak berubah (tombol utama masing-masing memanggil `handleStock`/`handleApprove`).
- Di `sparepart-client.tsx`, tambahkan prop `onReload={() => void reload()}` pada `<CentralStockDialogs>` (sisa props tidak berubah).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/app/sparepart/central-ui.test.ts src/app/app/sparepart/central-actions.test.ts -v && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/sparepart/central-stock-dialogs.tsx src/app/app/sparepart/sparepart-client.tsx src/app/app/sparepart/central-ui.test.ts
git commit -m "feat(ui): batch distribusi dengan preview di dialog sparepart"
```

---

### Task 4: Verifikasi akhir

**Files:** tidak ada perubahan kode.

- [ ] **Step 1: Jalankan verifikasi otomatis**

Run: `npm test && npm run typecheck`
Expected: semua lulus.
Run ESLint hanya pada file yang disentuh Task 1–3 → 0 error.

- [ ] **Step 2: Checklist manual**

- [ ] Pilih 3 item non-serial → muncul 3 baris → isi qty → preview → Kembali → edit qty → Konfirmasi → sukses, stok pusat berkurang sesuai total, stok cabang bertambah.
- [ ] Item serialized tidak muncul di picker batch; alur lama masih bisa distribusi IMEI.
- [ ] SKU dobel ditolak saat ditambahkan.
- [ ] Simulasikan `expected_stock` basi (ubah stok pusat lewat aksi lain sebelum Konfirmasi) → seluruh batch gagal, tidak ada baris cabang yang berubah, toast menyebut SKU, daftar me-reload dan tetap terbuka.
- [ ] Mobile: tabel bisa scroll horizontal di dalam dialog, header/footer tombol masih terjangkau, tidak ada tombol yang terpotong.

- [ ] **Step 3: Commit perbaikan kecil bila ada**

```powershell
git add <file yang diperbaiki>
git commit -m "fix: perbaikan akhir batch distribusi"
```
