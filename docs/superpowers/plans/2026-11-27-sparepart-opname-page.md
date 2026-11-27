# Halaman Stock Opname Sparepart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambah rute `/app/sparepart/opname` yang hanya menampilkan sesi opname sparepart dan tombol akses dari halaman `/app/sparepart`.

**Architecture:** `OpnameClient` yang sudah ada menerima prop `lockedDomain` untuk menyembunyikan tab Produk. Halaman baru memanggil server action `listSessions("sparepart")` yang sudah ada; detail sesi tetap memakai `/app/inventori/opname/[id]`.

**Tech Stack:** Next.js App Router, React/TypeScript, Tailwind, lucide-react, Vitest source-text tests.

**Spec:** `docs/superpowers/specs/2026-11-27-sparepart-opname-page-design.md`

## Global Constraints

- Rute baru persis `/app/sparepart/opname`.
- Halaman baru hanya menampilkan sesi `sparepart`; tab Produk tidak dirender.
- Tombol di header Sparepart tidak dibatasi `canManage`; izin posting tetap di `OPNAME_POSTER_ROLES` dan RPC.
- Tidak ada perubahan DB, migrasi, RPC, atau logika snapshot/posting opname.
- `refresh()` tetap mengambil daftar product dan sparepart seperti sebelumnya.

## Review Focus

- Halaman baru harus memakai menu guard `kategori_sparepart`, bukan membuka akses tanpa izin — diuji Task 2.
- Role tanpa izin posting tetap tidak boleh memposting — diuji Task 2 lewat `OPNAME_POSTER_ROLES`.
- Saat `lockedDomain` diisi, tab Produk tidak boleh muncul dan create session harus memakai domain sparepart — diuji Task 1.
- Tanpa `lockedDomain`, halaman opname lama harus tetap menampilkan dua tab — diuji Task 1.
- Tombol dari `/app/sparepart` harus menuju rute baru — diuji Task 2.

---

### Task 1: Kunci domain pada OpnameClient

**Files:**
- Modify: `src/app/app/inventori/opname/opname-client.tsx` (props ~106-114, state ~116, blok Tabs ~160-183)
- Test: `src/app/app/sparepart/opname/opname-page.test.ts` (bagian OpnameClient)

**Interfaces:**
- Consumes: `Domain` (`"product" | "sparepart"`), `SessionList`, `listSessions`, `createSession`.
- Produces: prop opsional `lockedDomain?: Domain` pada `OpnameClient`.

- [ ] **Step 1: Write the failing test**

Buat `src/app/app/sparepart/opname/opname-page.test.ts` dengan isi awal:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");
const list = read("src/app/app/inventori/opname/opname-client.tsx");

describe("OpnameClient dengan domain terkunci", () => {
  it("menerima lockedDomain dan memakainya sebagai state awal", () => {
    expect(list).toContain("lockedDomain?: Domain");
    expect(list).toContain('useState<Domain>(lockedDomain ?? "product")');
  });

  it("menyembunyikan tab saat terkunci dan tetap memakai SessionList", () => {
    expect(list).toContain("{lockedDomain ? (");
    expect(list).toContain("sessions={sessions[lockedDomain]}");
    expect(list).toContain("<TabsList>");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/app/sparepart/opname/opname-page.test.ts`
Expected: FAIL pada `lockedDomain?: Domain`.

- [ ] **Step 3: Implement lockedDomain**

Di `src/app/app/inventori/opname/opname-client.tsx`, ubah tanda tangan komponen:

```tsx
export function OpnameClient({
  products,
  spareparts,
  canPost,
  lockedDomain,
}: {
  products: OpnameSession[];
  spareparts: OpnameSession[];
  canPost: boolean;
  lockedDomain?: Domain;
}) {
```

Ubah state:

```tsx
  const [domain, setDomain] = useState<Domain>(lockedDomain ?? "product");
```

Bungkus blok `<Tabs>...</Tabs>` (baris ~160-183) dengan:

```tsx
      {lockedDomain ? (
        <SessionList
          sessions={sessions[lockedDomain]}
          onCreate={() => setNewOpen(true)}
          onOpen={openSession}
          onCancel={(id) => void cancel(id)}
          canPost={canPost}
        />
      ) : (
        <Tabs value={domain} onValueChange={(v) => setDomain(v as Domain)}>
          {/* isi Tabs lama persis seperti sebelumnya */}
        </Tabs>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/app/sparepart/opname/opname-page.test.ts src/app/app/inventori/opname/opname-page.test.ts`
Expected: PASS pada kedua file.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/inventori/opname/opname-client.tsx src/app/app/sparepart/opname/opname-page.test.ts
git commit -m "feat(opname): kunci domain sparepart pada daftar sesi"
```

---

### Task 2: Halaman dan tombol akses

**Files:**
- Create: `src/app/app/sparepart/opname/page.tsx`
- Modify: `src/app/app/sparepart/sparepart-client.tsx` (import ~6, `PageHeader.actions` ~165-186)
- Test: `src/app/app/sparepart/opname/opname-page.test.ts` (tambah describe)

**Interfaces:**
- Consumes: `requireMenu("kategori_sparepart")`, `listSessions("sparepart")`, `OPNAME_POSTER_ROLES`, `OpnameClient` dari Task 1.
- Produces: rute GET `/app/sparepart/opname` dan tautan dari header Sparepart.

- [ ] **Step 1: Write the failing tests**

Tambah ke `src/app/app/sparepart/opname/opname-page.test.ts`:

```ts
const page = read("src/app/app/sparepart/opname/page.tsx");
const sparepart = read("src/app/app/sparepart/sparepart-client.tsx");

describe("halaman opname sparepart", () => {
  it("memakai guard menu dan hanya memuat sesi sparepart", () => {
    expect(page).toContain('requireMenu("kategori_sparepart")');
    expect(page).toContain('listSessions("sparepart")');
    expect(page).toContain('lockedDomain="sparepart"');
    expect(page).toContain("products={[]}");
    expect(page).toContain("OPNAME_POSTER_ROLES");
  });

  it("tombol di halaman Sparepart menuju rute baru", () => {
    expect(sparepart).toContain('href="/app/sparepart/opname"');
    expect(sparepart).toContain("PackageCheckIcon");
    expect(sparepart).toContain("Stock Opname");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/app/sparepart/opname/opname-page.test.ts`
Expected: FAIL karena file page belum ada.

- [ ] **Step 3: Implement page and button**

Buat `src/app/app/sparepart/opname/page.tsx`:

```tsx
import { requireMenu } from "@/lib/auth/require-menu";
import { PageHeader } from "@/components/layout/page-header";
import { OPNAME_POSTER_ROLES } from "@/lib/operational/stock-opname";
import { OpnameClient } from "../../inventori/opname/opname-client";
import { listSessions } from "../../inventori/opname/actions";

export default async function Page() {
  const [sessions, actor] = await Promise.all([
    listSessions("sparepart"),
    requireMenu("kategori_sparepart"),
  ]);
  const canPost = OPNAME_POSTER_ROLES.includes(actor.role);

  return (
    <div className="min-h-svh bg-transparent text-foreground">
      <PageHeader
        title="Stock Opname Sparepart"
        titleClassName="font-heading text-2xl"
        description="Hitung stok fisik sparepart, tinjau selisih, lalu posting penyesuaian."
        containerClassName="max-w-4xl"
      />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <OpnameClient
          lockedDomain="sparepart"
          products={[]}
          spareparts={sessions}
          canPost={canPost}
        />
      </main>
    </div>
  );
}
```

Di `src/app/app/sparepart/sparepart-client.tsx`:
- tambah `PackageCheckIcon` ke import `lucide-react`;
- di `PageHeader.actions`, sebelum tombol **Beli Sparepart**, tambahkan:

```tsx
            <Button variant="outline" size="sm" className="h-8" render={<Link href="/app/sparepart/opname" />}>
              <PackageCheckIcon className="size-3.5" /> Stock Opname
            </Button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/app/sparepart/opname/opname-page.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify full suite and build**

Run:
```
npx tsc --noEmit
npm test -- --run
npm run build
```
Expected: `tsc` exit 0, seluruh tes lulus, build sukses.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/sparepart/opname/page.tsx src/app/app/sparepart/sparepart-client.tsx src/app/app/sparepart/opname/opname-page.test.ts
git commit -m "feat(sparepart): halaman stock opname khusus sparepart"
```

Catatan: jangan stage perubahan inventori/audit-log milik sesi lain.
