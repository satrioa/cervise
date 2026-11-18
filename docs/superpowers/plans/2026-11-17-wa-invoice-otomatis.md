# Invoice WhatsApp Otomatis via Meta Cloud API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saat servis dibuat, customer otomatis menerima invoice teks WhatsApp dan teknisi menerima "servis baru masuk", dikirim via Meta WhatsApp Cloud API memakai outbox + cron yang sudah ada.

**Architecture:** Pipeline outbox + trigger + cron tidak diubah. Dispatcher yang semula memanggil Fonnte diganti memanggil pengirim template Meta. Isi pesan dibangun sebagai parameter template, bukan string bebas. Tidak ada migrasi database.

**Tech Stack:** Next.js 16.3.6 (App Router, server-only libs), TypeScript, Vitest 3, Supabase service role, Meta Graph API v21.0 (`/messages`), GitHub Actions cron.

**Spec:** `docs/superpowers/specs/2026-11-17-wa-invoice-otomatis-design.md`

## Global Constraints

- Pengirim Meta: `POST https://graph.facebook.com/v21.0/{phone_number_id}/messages`, `Authorization: Bearer <META_WA_ACCESS_TOKEN>`.
- `META_WA_PHONE_NUMBER_ID = 1443653698834770` disimpan di env, **bukan** di kode.
- Token `EAA…` tidak boleh muncul di file mana pun; hanya env var.
- Template Meta category `Utility`, bahasa `id`, variabel **bernama** (`{{store_name}}`) dan payload memakai `parameter_name`; urutan tidak menentukan.
- Nama template dibaca dari env: `META_WA_TEMPLATE_INVOICE`, `META_WA_TEMPLATE_STATUS`, `META_WA_TEMPLATE_TECHNICIAN`.
- Env kosong ⇒ `skip: true`, baris outbox tetap `pending` dan dijadwalkan ulang (tidak boleh jadi terminal).
- Error `scope: "message"` ⇒ terminal; `scope: "infrastructure"` ⇒ retry sesuai backoff dispatcher yang ada.
- Nomor tujuan sudah berbentuk `62...` dari `toFonnteTarget()`; fungsi ini tetap dipakai (nama tidak diubah).
- Retry/backoff, dedupe, lease, dan batas 25 pesan/run tidak diubah.
- Gate: `npm test`, `npm run typecheck`, `npm run build` harus hijau. `npm run lint` bukan gate (error lama ditunda).

## Review Focus

- **`price_estimasi` null saat servis dibuat** → parameter kelima invoice harus "Menunggu pemeriksaan", bukan string kosong/`null`/`NaN`. Test: Task 2 fallback estimasi.
- **Event `servis_status`** → harus memakai template status, jangan template invoice. Test: Task 3 status template.
- **Template belum disetujui / nama salah (Meta 132001)** → terminal dengan `last_error` terbaca, bukan retry selamanya. Test: Task 1 error 132001.
- **Token di-rotate / env belum terisi** → `skip`, baris tetap `pending` dengan `next_attempt_at` di masa depan, bukan `failed`/`skipped`. Test: Task 1 skip + Task 3 skip.
- **`wamid` dari Meta** → `provider_message_id` terbaca dari `messages[0].id`, bukan bentuk lama Fonnte. Test: Task 3 ekstraksi ID.

---

### Task 1: Pengirim Meta WhatsApp

**Files:**
- Create: `src/lib/meta-wa.ts`
- Test: `src/lib/meta-wa.test.ts`

**Interfaces:**
- Consumes: `process.env.META_WA_ACCESS_TOKEN`, `process.env.META_WA_PHONE_NUMBER_ID`.
- Produces:
  - `export type TemplateParameter = { type: "text"; value: string }`
  - `export class MetaWaError extends Error` dengan `reason: string`, `scope: "message" | "infrastructure"`, `retryable: boolean`
  - `export async function sendMetaWA(phone: string, templateName: string, parameters: TemplateParameter[]): Promise<{ skip: true } | { skip: false; status: true; detail: Record<string, unknown> }>`

- [ ] **Step 1: Write the failing test**

Buat `src/lib/meta-wa.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { MetaWaError, sendMetaWA } from "./meta-wa";

const original = {
  token: process.env.META_WA_ACCESS_TOKEN,
  phoneNumberId: process.env.META_WA_PHONE_NUMBER_ID,
};

afterEach(() => {
  if (original.token === undefined) delete process.env.META_WA_ACCESS_TOKEN;
  else process.env.META_WA_ACCESS_TOKEN = original.token;
  if (original.phoneNumberId === undefined) delete process.env.META_WA_PHONE_NUMBER_ID;
  else process.env.META_WA_PHONE_NUMBER_ID = original.phoneNumberId;
  vi.unstubAllGlobals();
});

function ok(body: Record<string, unknown> = { messages: [{ id: "wamid.1" }] }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("sendMetaWA", () => {
  it("skip tanpa token", async () => {
    delete process.env.META_WA_ACCESS_TOKEN;
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendMetaWA("628123456789", "invoice", [])).resolves.toEqual({ skip: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skip tanpa phone number id", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    delete process.env.META_WA_PHONE_NUMBER_ID;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendMetaWA("628123456789", "invoice", [])).resolves.toEqual({ skip: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skip tanpa nama template", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendMetaWA("628123456789", "", [])).resolves.toEqual({ skip: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mengirim payload template berurutan ke Graph API", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    const parameters = [
      { type: "text" as const, value: "Servisin" },
      { type: "text" as const, value: "SRV-2026-0012" },
    ];

    await expect(sendMetaWA("628123456789", "invoice", parameters)).resolves.toEqual({
      skip: false,
      status: true,
      detail: { messages: [{ id: "wamid.1" }] },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v21.0/1443653698834770/messages",
      expect.objectContaining({ method: "POST" }),
    );
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.headers).toEqual({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(options.body as string)).toEqual({
      messaging_product: "whatsapp",
      to: "628123456789",
      type: "template",
      template: {
        name: "invoice",
        language: { code: "id" },
        components: [{ type: "body", parameters }],
      },
    });
  });

  it("membalas 190 sebagai infrastructure agar token bisa di-rotate", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 190, message: "Invalid OAuth access token" } }), { status: 401 }),
      ),
    );

    const error = await sendMetaWA("628123456789", "invoice", []).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MetaWaError);
    expect((error as MetaWaError).reason).toBe("Invalid OAuth access token");
    expect((error as MetaWaError).scope).toBe("infrastructure");
    expect((error as MetaWaError).retryable).toBe(true);
  });

  it("membalas 131026 sebagai message-scoped", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 131026, message: "Message undeliverable" } }), { status: 400 }),
      ),
    );

    const error = await sendMetaWA("628123456789", "invoice", []).catch((e: unknown) => e);
    expect((error as MetaWaError).scope).toBe("message");
    expect((error as MetaWaError).retryable).toBe(false);
  });

  it("membalas template tidak ada (132001) sebagai message-scoped", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 132001, message: "Template does not exist" } }), { status: 400 }),
      ),
    );

    const error = await sendMetaWA("628123456789", "invoice", []).catch((e: unknown) => e);
    expect((error as MetaWaError).reason).toBe("Template does not exist");
    expect((error as MetaWaError).scope).toBe("message");
  });

  it("membalas 5xx tanpa body sebagai infrastructure", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));

    const error = await sendMetaWA("628123456789", "invoice", []).catch((e: unknown) => e);
    expect((error as MetaWaError).reason).toBe("HTTP 503");
    expect((error as MetaWaError).scope).toBe("infrastructure");
    expect((error as MetaWaError).retryable).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/meta-wa.test.ts`
Expected: FAIL — `Failed to resolve import "./meta-wa"`.

- [ ] **Step 3: Write minimal implementation**

Buat `src/lib/meta-wa.ts`:

```ts
// Integrasi WhatsApp Cloud API (Meta). Fetch ringan, tanpa dependency.
// Pesan business-initiated wajib memakai template yang sudah disetujui Meta,
// jadi pengirim ini hanya menerima nama template + parameter berurutan.

export type TemplateParameter = { type: "text"; value: string };

export type MetaWaResult =
  | { skip: true }
  | { skip: false; status: true; detail: Record<string, unknown> };

const MESSAGE_SCOPED_CODES = new Set([100, 131009, 131026, 132001]);

/**
 * `message` = nomor, parameter, atau template yang salah; mengulangnya tidak
 * akan berhasil. `infrastructure` = token/Fonnte/jaringan yang bermasalah;
 * pesannya masih layak dicoba lagi. Token dipakai bersama semua tenant, jadi
 * 190 tidak boleh terminal.
 */
export class MetaWaError extends Error {
  readonly reason: string;
  readonly scope: "message" | "infrastructure";
  readonly retryable: boolean;

  constructor(reason: string, scope: "message" | "infrastructure") {
    super(`Meta WhatsApp gagal: ${reason}`);
    this.name = "MetaWaError";
    this.reason = reason;
    this.scope = scope;
    this.retryable = scope !== "message";
  }
}

function isMessageScoped(code: unknown, reason: string | null): boolean {
  if (typeof code === "number" && MESSAGE_SCOPED_CODES.has(code)) return true;
  if (!reason) return false;
  const lower = reason.toLowerCase();
  return (
    lower.includes("invalid parameter") ||
    lower.includes("undeliverable") ||
    lower.includes("template does not exist")
  );
}

export async function sendMetaWA(
  phone: string,
  templateName: string,
  parameters: TemplateParameter[],
): Promise<MetaWaResult> {
  const token = process.env.META_WA_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId || !templateName) return { skip: true };

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: "id" },
          components: [{ type: "body", parameters }],
        },
      }),
    },
  );

  let payload: Record<string, unknown> = {};
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  const apiError = payload.error as { message?: unknown; code?: unknown } | undefined;
  if (!res.ok || apiError) {
    const rawReason =
      typeof apiError?.message === "string" && apiError.message ? apiError.message : null;
    const reason = rawReason ?? `HTTP ${res.status}`;
    throw new MetaWaError(
      reason,
      isMessageScoped(apiError?.code, rawReason) ? "message" : "infrastructure",
    );
  }

  return { skip: false, status: true, detail: payload };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/meta-wa.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/meta-wa.ts src/lib/meta-wa.test.ts
git commit -m "feat: Meta WhatsApp template sender"
```

---

### Task 2: Parameter template pesan servis

**Files:**
- Modify: `src/lib/notifications/service-message.ts:9-20` (tipe input), `:83-133` (builder baru)
- Test: `src/lib/notifications/service-message.test.ts:10-20`, `:139-182`

**Interfaces:**
- Consumes: `TemplateParameter` dari `@/lib/meta-wa` (type-only import), `publicLacakUrl()` dan `internalServisUrl()` yang sudah ada di file yang sama.
- Produces:
  - `buildCustomerInvoiceParameters(input: ServiceMessageInput): TemplateParameter[]` — 7 parameter
  - `buildCustomerStatusParameters(input: ServiceMessageInput): TemplateParameter[]` — 6 parameter
  - `buildTechnicianJobParameters(input: ServiceMessageInput): TemplateParameter[]` — 5 parameter
  - `ServiceMessageInput` ditambah `priceEstimasi: number | null`, `garansiValue: number | null`, `garansiUnit: "hari" | "bulan" | "tahun" | null`

- [ ] **Step 1: Write the failing test**

Tambahkan import di `src/lib/notifications/service-message.test.ts`:

```ts
import {
  buildCustomerCreatedMessage,
  buildCustomerInvoiceParameters,
  buildCustomerStatusMessage,
  buildCustomerStatusParameters,
  buildTechnicianCreatedMessage,
  buildTechnicianJobParameters,
  publicLacakUrl,
  type ServiceMessageInput,
} from "./service-message";
```

Tambahkan field ke `base` (baris 10-20):

```ts
const base: ServiceMessageInput = {
  storeName: "Servisin",
  tenantSlug: "servisin",
  serviceId: "3f1c2b44-0000-4000-8000-000000000001",
  serviceNumber: "SRV-2026-0012",
  device: "Xiaomi Redmi 13C",
  complaint: "Layar pecah, Baterai drop",
  trackingCode: "F5FB0DFCB6",
  status: "Masuk",
  siteOrigin: "https://app.kaggo.id",
  priceEstimasi: null,
  garansiValue: null,
  garansiUnit: null,
};
```

Tambahkan blok test di akhir file:

```ts
describe("parameter template invoice customer", () => {
  it("mengisi tujuh parameter berurutan", () => {
    expect(
      buildCustomerInvoiceParameters({
        ...base,
        priceEstimasi: 150000,
        garansiValue: 3,
        garansiUnit: "bulan",
      }),
    ).toEqual([
      { type: "text", value: "Servisin" },
      { type: "text", value: "SRV-2026-0012" },
      { type: "text", value: "Xiaomi Redmi 13C" },
      { type: "text", value: "Layar pecah, Baterai drop" },
      { type: "text", value: "Rp 150.000" },
      { type: "text", value: "3 bulan" },
      { type: "text", value: "https://app.kaggo.id/servisin/lacak/F5FB0DFCB6" },
    ]);
  });

  it("memakai fallback saat estimasi dan field lain kosong", () => {
    const params = buildCustomerInvoiceParameters({
      ...base,
      serviceNumber: null,
      complaint: null,
      trackingCode: null,
      siteOrigin: null,
      priceEstimasi: null,
    });
    expect(params.map((p) => p.value)).toEqual([
      "Servisin",
      "Xiaomi Redmi 13C",
      "Xiaomi Redmi 13C",
      "-",
      "Menunggu pemeriksaan",
      "-",
      "-",
    ]);
    for (const param of params) expect(param.value).not.toContain("undefined");
  });

  it("tidak merender estimasi 0 sebagai Rp 0", () => {
    const params = buildCustomerInvoiceParameters({ ...base, priceEstimasi: 0 });
    expect(params[4].value).toBe("Menunggu pemeriksaan");
  });
});

describe("parameter template status customer", () => {
  it("memakai status yang diteruskan, bukan status hardcode", () => {
    const params = buildCustomerStatusParameters({ ...base, status: "Sudah Diambil" });
    expect(params.map((p) => p.value)).toEqual([
      "Servisin",
      "SRV-2026-0012",
      "Xiaomi Redmi 13C",
      "Sudah Diambil",
      "F5FB0DFCB6",
      "https://app.kaggo.id/servisin/lacak/F5FB0DFCB6",
    ]);
  });
});

describe("parameter template teknisi", () => {
  it("mengisi lima parameter berurutan", () => {
    expect(buildTechnicianJobParameters(base)).toEqual([
      { type: "text", value: "Servisin" },
      { type: "text", value: "SRV-2026-0012" },
      { type: "text", value: "Xiaomi Redmi 13C" },
      { type: "text", value: "Layar pecah, Baterai drop" },
      { type: "text", value: "https://app.kaggo.id/app/servis/3f1c2b44-0000-4000-8000-000000000001" },
    ]);
  });

  it("mengganti tautan kosong dengan '-' bukan '/app/servis/' menggantung", () => {
    const params = buildTechnicianJobParameters({ ...base, siteOrigin: null });
    expect(params[4].value).toBe("-");
  });
});
```

Perbaiki juga literal `ServiceMessageInput` di test "tetap menyebut nama toko walau field lain kosong" (baris ~95) dan "tidak pernah merender undefined" (baris ~156) dengan menambahkan:

```ts
  priceEstimasi: null,
  garansiValue: null,
  garansiUnit: null,
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notifications/service-message.test.ts`
Expected: FAIL — `buildCustomerInvoiceParameters is not a function` / TS error `priceEstimasi does not exist`.

- [ ] **Step 3: Write minimal implementation**

Di `src/lib/notifications/service-message.ts`, tambahkan setelah komentar pembuka:

```ts
import type { TemplateParameter } from "@/lib/meta-wa";
```

Ubah tipe `ServiceMessageInput` menjadi:

```ts
export type ServiceMessageInput = {
  storeName: string;
  tenantSlug: string | null;
  serviceId: string;
  serviceNumber: string | null;
  device: string;
  complaint: string | null;
  trackingCode: string | null;
  status: string | null;
  /** Bisa null: task berikutnya membacanya dari env yang belum terkonfigurasi. */
  siteOrigin: string | null;
  priceEstimasi: number | null;
  garansiValue: number | null;
  garansiUnit: "hari" | "bulan" | "tahun" | null;
};
```

Tambahkan di akhir file:

```ts
/**
 * Parameter template tidak boleh kosong: Meta menolak value "". Field yang
 * tidak ada diganti "-", bukan teks karangan yang terlihat seperti data.
 */
function param(value: string | null | undefined): TemplateParameter {
  return { type: "text", value: present(value) ?? "-" };
}

export function buildCustomerInvoiceParameters(input: ServiceMessageInput): TemplateParameter[] {
  const estimate =
    input.priceEstimasi !== null &&
    Number.isFinite(input.priceEstimasi) &&
    input.priceEstimasi > 0
      ? `Rp ${new Intl.NumberFormat("id-ID").format(input.priceEstimasi)}`
      : "Menunggu pemeriksaan";
  const warranty =
    input.garansiValue !== null && input.garansiUnit
      ? `${input.garansiValue} ${input.garansiUnit}`
      : "-";

  return [
    param(input.storeName),
    param(input.serviceNumber ?? input.device),
    param(input.device),
    param(input.complaint),
    { type: "text", value: estimate },
    { type: "text", value: warranty },
    param(publicLacakUrl(input.siteOrigin, input.tenantSlug, input.trackingCode)),
  ];
}

export function buildCustomerStatusParameters(input: ServiceMessageInput): TemplateParameter[] {
  return [
    param(input.storeName),
    param(serviceRef(input)),
    param(input.device),
    param(input.status),
    param(input.trackingCode),
    param(publicLacakUrl(input.siteOrigin, input.tenantSlug, input.trackingCode)),
  ];
}

export function buildTechnicianJobParameters(input: ServiceMessageInput): TemplateParameter[] {
  return [
    param(input.storeName),
    param(serviceRef(input)),
    param(input.device),
    param(input.complaint),
    param(internalServisUrl(input.siteOrigin, input.serviceId)),
  ];
}
```

`buildCustomerCreatedMessage`, `buildCustomerStatusMessage`, dan
`buildTechnicianCreatedMessage` **dibiarkan** (masih diuji test lama); hanya
tidak lagi dipakai dispatcher setelah Task 3.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/notifications/service-message.test.ts`
Expected: PASS (semua test lama + 6 test baru).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/service-message.ts src/lib/notifications/service-message.test.ts
git commit -m "feat: template parameters for service WhatsApp messages"
```

---

### Task 3: Dispatcher kirim lewat Meta

**Files:**
- Modify: `src/lib/notifications/dispatcher.ts` (imports, tipe, `resolveRow`, pemanggilan kirim, mapping error)
- Test: `src/lib/notifications/dispatcher.test.ts`

**Interfaces:**
- Consumes: `sendMetaWA`, `MetaWaError`, `TemplateParameter` (Task 1); builder Task 2; RPC `claim_service_notifications` yang sudah ada.
- Produces: `DispatchResult` tidak berubah (`{ sent, skipped, failed }`). `Resolved` berubah menjadi `{ target, template, parameters } | { skip }`.

- [ ] **Step 1: Update test mock dan expectation**

Di `src/lib/notifications/dispatcher.test.ts`:

1. Import `afterEach` dan `beforeEach` dari vitest, lalu tambahkan state env template:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalTemplates = {
  invoice: process.env.META_WA_TEMPLATE_INVOICE,
  technician: process.env.META_WA_TEMPLATE_TECHNICIAN,
  status: process.env.META_WA_TEMPLATE_STATUS,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalTemplates)) {
    const name = `META_WA_TEMPLATE_${key.toUpperCase()}`;
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
```

2. Ganti kelas `FakeFonnteError` di dalam `vi.hoisted` dengan `FakeMetaWaError` (konstruktor tetap `(reason, scope)`), dan ganti mock module:

```ts
vi.mock("@/lib/meta-wa", () => ({
  sendMetaWA: mocks.sendMetaWA,
  MetaWaError: FakeMetaWaError,
}));
```

Di `vi.hoisted`, ganti `sendFonnteWA: vi.fn()` menjadi `sendMetaWA: vi.fn()`.

3. Di `beforeEach`, tambahkan:

```ts
process.env.META_WA_TEMPLATE_INVOICE = "invoice-template";
process.env.META_WA_TEMPLATE_TECHNICIAN = "technician-template";
process.env.META_WA_TEMPLATE_STATUS = "status-template";
```

4. Tambahkan field ke konstanta `SERVIS` (baris 80-93):

```ts
  price_estimasi: null,
  garansi_value: null,
  garansi_unit: null,
```

5. Ganti **semua** `mocks.sendFonnteWA` menjadi `mocks.sendMetaWA` (replace all).

6. Ganti expectation argumen kirim customer (baris ~242):

```ts
expect(mocks.sendMetaWA).toHaveBeenCalledWith(
  "6281234567890",
  "invoice-template",
  expect.arrayContaining([expect.objectContaining({ value: "F5FB0DFCB6" })]),
);
```

7. Ganti expectation argumen kirim status (baris ~315):

```ts
expect(mocks.sendMetaWA).toHaveBeenCalledWith(
  "628123456789",
  "status-template",
  expect.arrayContaining([expect.objectContaining({ value: "Selesai" })]),
);
```

8. Ganti expectation argumen kirim teknisi (baris ~447):

```ts
expect(mocks.sendMetaWA).toHaveBeenCalledWith(
  "628999999999",
  "technician-template",
  expect.arrayContaining([expect.objectContaining({ value: "SRV-2026-0012" })]),
);
```

9. Ganti bentuk `detail` pada tiga test `provider_message_id`:
   - `{ id: "abc", detail: { id: "wm-77123" } }` → `{ messages: [{ id: "wm-77123" }] }`
   - `detail: { detail: { id: 12345 } }` → `detail: { messages: [{ id: 12345 }] }`
   - `detail: { status: true }` tetap.

10. Ganti semua `new FakeFonnteError(` menjadi `new FakeMetaWaError(`.

11. Ganti `last_error: "fonnte_not_configured"` menjadi `last_error: "meta_wa_not_configured"` (dua tempat: test skip dan regression guard).

12. Tambahkan test baru di dalam `describe("pengiriman")`:

```ts
it("menyertakan estimasi dan garansi pada template invoice", async () => {
  state.claimed = [row()];
  state.servis = [{ ...SERVIS, price_estimasi: 150000, garansi_value: 3, garansi_unit: "bulan" }];
  state.customers = [{ id: "c1", phone: "628123456789" }];

  await dispatchPendingNotifications({ siteOrigin: ORIGIN });

  expect(mocks.sendMetaWA).toHaveBeenCalledWith(
    "628123456789",
    "invoice-template",
    expect.arrayContaining([
      expect.objectContaining({ value: "Rp 150.000" }),
      expect.objectContaining({ value: "3 bulan" }),
    ]),
  );
});
```

13. Di test "bekerja tanpa siteOrigin" (baris ~855), ganti dua expectation:

```ts
const parameters = mocks.sendMetaWA.mock.calls[0][2] as { value: string }[];
const values = parameters.map((p) => p.value).join(" ");
expect(values).not.toContain("undefined");
expect(values).not.toContain("/lacak/");
```

14. Di test "memakai nama toko dari cabang" (baris ~870), ganti:

```ts
const parameters = mocks.sendMetaWA.mock.calls[0][2] as { value: string }[];
expect(parameters.map((p) => p.value)).toContain("Servis diterima");
```

**Catatan penting:** teks lama "Servis diterima" tidak lagi dipakai template invoice. Test ini memakai servis tanpa organisasi, jadi nama tokonya kosong dan parameter pertama harus `"-"` — bukan nama karangan "Kaggo". Ganti assertion itu menjadi:

```ts
expect(parameters[0].value).toBe("-");
expect(parameters).toHaveLength(7);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notifications/dispatcher.test.ts`
Expected: FAIL — modul `@/lib/meta-wa` belum dipakai dispatcher, mock tidak cocok.

- [ ] **Step 3: Update implementation**

Di `src/lib/notifications/dispatcher.ts`:

1. Ganti imports baris 1 dan 4-9:

```ts
import { MetaWaError, sendMetaWA, type TemplateParameter } from "@/lib/meta-wa";
import { toFonnteTarget } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildCustomerInvoiceParameters,
  buildCustomerStatusParameters,
  buildTechnicianJobParameters,
  type ServiceMessageInput,
} from "./service-message";
```

2. Hapus `const COUNTRY_CODE = "62";` (baris ~50) — Meta tidak memakai country code; nomor sudah `62...`.

3. Tambahkan `price_estimasi`, `garansi_value`, `garansi_unit` ke `ServisRow` (setelah `price_estimasi` yang sudah ada?) — `ServisRow` saat ini tidak punya `price_estimasi`. Tambahkan tiga field:

```ts
  price_estimasi: number | null;
  garansi_value: number | null;
  garansi_unit: "hari" | "bulan" | "tahun" | null;
```

4. Ubah `Resolved`:

```ts
type Resolved =
  | { target: string; template: string; parameters: TemplateParameter[] }
  | { skip: string };
```

5. Ubah `providerMessageIdOf`:

```ts
function providerMessageIdOf(detail: unknown): string | null {
  const messages = (detail as { messages?: { id?: unknown }[] } | null)?.messages;
  const id = messages?.[0]?.id;
  if (typeof id === "string" && id.trim() !== "") return id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return null;
}
```

6. Ubah `errorText`:

```ts
function errorText(error: unknown): string {
  if (error instanceof MetaWaError) return error.reason;
  return error instanceof Error ? error.message : String(error);
}
```

7. Tambahkan parameter `templates` ke `resolveRow`:

```ts
function resolveRow(
  row: OutboxRow,
  servis: ServisRow | undefined,
  customer: CustomerRow | undefined,
  technician: TechnicianRow | undefined,
  siteOrigin: string,
  templates: { invoice: string; technician: string; status: string },
): Resolved {
```

8. Di `resolveRow`, perluas `input`:

```ts
    siteOrigin,
    priceEstimasi: servis.price_estimasi,
    garansiValue: servis.garansi_value,
    garansiUnit: servis.garansi_unit,
  };
```

9. Ganti cabang customer (baris ~197-210):

```ts
  if (row.to_kind === "customer") {
    if (!customer) return { skip: "customer_not_found" };
    const target = toFonnteTarget(customer.phone);
    if (!target) return { skip: "no_phone" };
    return {
      target,
      template: row.event === "servis_created" ? templates.invoice : templates.status,
      parameters:
        row.event === "servis_created"
          ? buildCustomerInvoiceParameters(input)
          : buildCustomerStatusParameters(input),
    };
  }
```

10. Ganti pengembalian teknisi (baris ~230):

```ts
  return {
    target,
    template: templates.technician,
    parameters: buildTechnicianJobParameters(input),
  };
```

11. Di `dispatchPendingNotifications`, setelah `const siteOrigin = ...`, tambahkan:

```ts
  const templates = {
    invoice: process.env.META_WA_TEMPLATE_INVOICE ?? "",
    technician: process.env.META_WA_TEMPLATE_TECHNICIAN ?? "",
    status: process.env.META_WA_TEMPLATE_STATUS ?? "",
  };
```

12. Tambahkan field ke `select` servis (baris ~279):

```ts
        "id, service_number, device, complaint, tracking_code, status, price_estimasi, garansi_value, garansi_unit, customer_id, teknisi_id, branches(organization_id, organizations(name, slug))",
```

13. Teruskan `templates` ke `resolveRow` (baris ~343):

```ts
        siteOrigin,
        templates,
      );
```

14. Ganti deklarasi & pemanggilan kirim (baris ~368-370):

```ts
      let response: Awaited<ReturnType<typeof sendMetaWA>>;
      try {
        response = await sendMetaWA(resolved.target, resolved.template, resolved.parameters);
```

15. Ganti mapping terminal (baris ~377):

```ts
        const terminal = error instanceof MetaWaError && error.scope === "message";
```

16. Ganti `last_error: "fonnte_not_configured"` menjadi `last_error: "meta_wa_not_configured"` dan perbarui komentar yang menyebut FONNTE_TOKEN menjadi variabel Meta.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/notifications/dispatcher.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/dispatcher.ts src/lib/notifications/dispatcher.test.ts
git commit -m "feat: dispatch service notifications through Meta WhatsApp"
```

---

### Task 4: Konfigurasi env, cron, dan verifikasi akhir

**Files:**
- Modify: `.env.example`
- Modify: `DEPLOY.md`
- Modify: `.github/workflows/service-notifications-cron.yml`
- Modify: `src/lib/meta-wa.test.ts` (opsional: pastikan nama template tidak hardcode di kode — sudah dijamin Task 1)

**Interfaces:**
- Consumes: env vars dari Task 1 & Task 3.
- Produces: environment siap pakai + cron aktif.

- [ ] **Step 1: Tambah env var ke `.env.example`**

Tambahkan setelah blok Fonnte:

```
# Meta WhatsApp Cloud API (invoice & notifikasi servis).
META_WA_ACCESS_TOKEN=<meta-system-user-token>
META_WA_PHONE_NUMBER_ID=1443653698834770
META_WA_TEMPLATE_INVOICE=<nama-template-invoice>
META_WA_TEMPLATE_STATUS=<nama-template-status>
META_WA_TEMPLATE_TECHNICIAN=<nama-template-teknisi>
```

- [ ] **Step 2: Update `DEPLOY.md`**

Tambah baris tabel setelah `FONNTE_TOKEN`:

```
| `META_WA_ACCESS_TOKEN` | ya | token Meta; rahasia, jangan di-commit |
| `META_WA_PHONE_NUMBER_ID` | ya | nomor pengirim Meta |
| `META_WA_TEMPLATE_INVOICE` | ya | template invoice customer |
| `META_WA_TEMPLATE_STATUS` | ya | template status customer |
| `META_WA_TEMPLATE_TECHNICIAN` | ya | template teknisi |
```

Ubah bagian "Cron & notifikasi" menjadi: jadwal `*/5 * * * *` sudah diaktifkan via GitHub Actions; sebelum mengaktifkan, expiry baris pending lama:

```sql
update public.cervise_notification_outbox
set state = 'failed', last_error = 'expired_before_activation'
where state = 'pending';
```

- [ ] **Step 3: Aktifkan cron**

Di `.github/workflows/service-notifications-cron.yml`, ubah komentar pembuka yang menyatakan notifikasi dimatikan, lalu tambahkan di bawah `on:`:

```yaml
  schedule:
    - cron: "*/5 * * * *"
```

Pastikan `CRON_SECRET` terdaftar sebagai GitHub Secret (sudah dipakai di langkah `curl`).

- [ ] **Step 4: Verifikasi gate**

Run (jalankan semua, hentikan jika ada yang gagal):

```bash
npm test
npm run typecheck
npm run build
```

Expected: semua hijau. Jika `npm test` gagal pada test lama yang masih mengira pesan Fonnte, perbaiki test yang bersangkutan di Task 3, jangan mengembalikan pengirim Fonnte.

- [ ] **Step 5: Commit**

```bash
git add .env.example DEPLOY.md .github/workflows/service-notifications-cron.yml
git commit -m "chore: configure Meta WhatsApp env and re-enable notification cron"
```

- [ ] **Step 6: Smoke test manual (setelah deploy & template approved)**

1. Pastikan kelima env var terpasang di Vercel dan `CRON_SECRET` di GitHub Secret.
2. Buat 3 template di Meta Business Manager dan tunggu status **APPROVED**.
3. Jalankan SQL expiry baris pending lama (lihat Step 2).
4. Pastikan workflow cron sudah aktif (ada trigger `schedule`).
5. Buat satu servis baru di aplikasi.
6. Trigger manual workflow (`workflow_dispatch`) atau tunggu ≤5 menit.
7. Verifikasi: customer menerima invoice, teknisi menerima "servis baru masuk".
8. Verifikasi database:

```sql
select event, to_kind, state, last_error, provider_message_id, sent_at
from public.cervise_notification_outbox
order by created_at desc
limit 4;
```

Expected: empat baris untuk dua servis terakhir ber-`state = 'sent'` dengan `provider_message_id` diawali `wamid.`.
