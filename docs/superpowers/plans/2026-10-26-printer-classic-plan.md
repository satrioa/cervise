# Printer Classic (RawBT + Web Serial) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or native mode. Steps use `- [ ]` checkbox syntax for self-task tracking.

**Goal:** Let 58mm ESC/POS printers connected via Bluetooth **Classic (SPP)** or desktop COM ports work with the existing `lib/printer/` flow, without touching receipt/escpos builders.

**Architecture:** One new transport (`rawbt.ts`) for Android→RawBT, one option added to `webSerial.ts` (baudRate), `detect.ts`/`storage.ts`/`index.ts` to choose/save transport, and a picker in the existing `PrinterCard`. Layout builders untouched.

**Spec:** [`docs/superpowers/specs/2026-10-26-rawbt-design.md`](./2026-10-26-rawbt-design.md)

## Global Constraints
- TypeScript strict (`tsc --noEmit` clean).
- ESLint clean on changed files (no new `@typescript-eslint/no-explicit-any`; the codebase already has some pre-existing — do not worsen).
- Next.js App Router; Web API access guarded (`typeof navigator/localStorage !== "undefined"`).
- No new dependencies (no `@types/web-serial` either; keep minimal local types).
- Bahasa Indonesia pada semua user-facing string + pesan error.
- Tidak mengubah `escpos.ts`, `receipt.ts`, atau logika bisnis order/penjualan/servis di luar printer-card.tsx.
- `package.json` / `src/lib/auth/*` tidak disentuh.

## Review Focus (inputs most likely to bite a user)
1. **Long receipt → RawBT intent URL too long (>~2000 chars)** → throw clear error, fall back to browser print. (Pinned in `rawbt.test.ts`.)
2. **Non-ASCII in RawBT payload** → base64 handles bytes; receipt already ASCII-normalized by escpos, so no extra step.
3. **baudRate mismatch on a Classic COM port** (printer ignores 9600) → dropdown lets user pick 38400/115200.
4. **Port already in use** → friendly Indonesian message, not a raw OS error.
5. **Printer BLE vs Classic ambiguity for the user** → picker + hint text.

---

## Files

New / modified (owned by tasks):

| File | Action | Responsible task |
|---|---|---|
| `src/lib/printer/types.ts` | add `"rawbt"` to `TransportId` | Task 1 |
| `src/lib/printer/transports/rawbt.ts` | create | Task 2 |
| `src/lib/printer/transports/rawbt.test.ts` | create | Task 2 |
| `src/lib/printer/storage.ts` | add baud + printer-type getters/setters | Task 3 |
| `src/lib/printer/transports/webSerial.ts` | add baudRate option + friendly errors | Task 3 |
| `src/lib/printer/transports/webSerial.test.ts` | create | Task 3* |
| `src/lib/printer/detect.ts` | add rawbt + platform priority order | Task 4 |
| `src/lib/printer/transports/detect.test.ts` | create | Task 4 |
| `src/lib/printer/index.ts` | consume saved transport incl. rawbt; printTest guard | Task 5 |
| `src/components/pengaturan/printer-card.tsx` | add "Jenis printer" dropdown + RawBT guidance | Task 5 |
| `docs/printing.md` | RawBT + PC Classic + baud + iOS note | Task 6 |

(Task 3* webSerial.test.ts optional; skip if no clean env. Minimal.)

## Task decomposition (order is the implementation order — finish bottom tasks first so earlier types exist)

### Task 6: docs/printing.md
Docs only; do first so guidance exists.
- Add section **"Printer Bluetooth Classic (SPP) di Android — RawBT"**: install, pair di Android Settings → Bluetooth, aktifkan Cetak Otomatis/Tanpa Konfirmasi di RawBT, batasan app pihak ketiga.
- Revise PC section: "printer Classic yang sudah dipasangkan → port COM → Web Serial. Pilih port *Standard Serial over Bluetooth link*".
- Add **"Pilih baudRate"**: 9600 default, 19200/38400/115200.
- Add **iOS**: tanpa MFi, Classic SPP tidak tersedia.
- Add **"Jenis printer" picker** hint.

### Task 5: index.ts + printer-card.tsx
Depends on Tasks 1–4.

**File:** modify `src/lib/printer/index.ts`
- Change `activeDirect()` to read **saved printer type** (`storage.getSavedPrinterType()`) which may be `rawbt` — add import.
- In `printTest()`, skip `rawbt` (opening an intent on a test print is odd) → throw `"Gunakan Cetak Nota untuk mencetak via RawBT"`.
- Re-export `getSavedPrinterType`/`savePrinterType`/`getPrinterBaud`/`savePrinterBaud`/`supportedTransports`.

**File:** modify `src/components/pengaturan/printer-card.tsx`
- Replace `PrinterSettings` saved-device block with:
  - `<Select>` labeled "Jenis printer" showing options from `supportedTransports()` (BLE / RawBT / USB), value = saved type, onValueChange → `savePrinterType(id)`; if no saved type, default to `bestDirectTransport()?.id`.
  - If `rawbt` supported but not the selected transport → toast hint "Pasang & buka app RawBT di Android".
  - When direct.length===0 still fallback message unchanged.
- Buttons: Hubungkan/Cetak Tes/Putuskan unchanged; for `rawbt` "Hubungkan" → connectPrinter() sets configured flag and toasts guidance.

**Interfaces:**
- Uses `supportedTransports()`, `bestDirectTransport()`, `connectPrinter`, `printTest`, `getPrinterStatus`, `disconnectPrinter`, `savePrinterType`, `getSavedPrinterType` from `@/lib/printer`.

### Task 4: detect.ts
Depends on Task 1.

**File:** modify `src/lib/printer/detect.ts`
- Add import { rawbt } from "./transports/rawbt".
- `TRANSPORTS` array order: `[webSerial, webBluetooth, rawbt, browserPrint]`.
  - Reason: webSerial.isSupported() is false on Android; rawbt.isSupported() only Android. On PC webSerial ranks first; on Android webSerial false → webBluetooth if BLE → rawbt.
- Keep exported functions; no signature change.

**Test:** `src/lib/printer/transports/detect.test.ts` (or `src/lib/printer/detect.test.ts`)
```ts
import { describe, expect, it, vi } from "vitest";
import { bestDirectTransport, supportedTransports } from "./detect";

it("prioritaskan Web Serial di PC", () => {
  vi.stubGlobal("navigator", { serial: { getPorts: () => Promise.resolve([]) } });
  const ids = supportedTransports().map((t) => t.id);
  expect(ids).toEqual(["webSerial"]);
});

it("prioritaskan BLE lalu RawBT di Android (tanpa BLE)", () => {
  // Android tanpa Web Bluetooth -> harus menyatu saja rawbt
});
```
*(Mock navigator; keep assertions loose — assert order contains rawbt / webSerial.)*

### Task 3: webSerial.ts + storage.ts
**Files:** `src/lib/printer/transports/webSerial.ts`, `src/lib/printer/storage.ts`

**storage.ts add:**
```ts
export const BAUD_OPTIONS = [9600, 19200, 38400, 115200] as const;
const BAUD_KEY = "cervise-printer-baud";
export function getPrinterBaud(): number { ...default 9600 }
export function savePrinterBaud(v: number): void { ... }
const TYPE_KEY = "cervise-printer-type";
export type SavedPrinterType = "webBluetooth" | "webSerial" | "rawbt";
export function getSavedPrinterType(): SavedPrinterType | null { ... }
export function savePrinterType(id: SavedPrinterType | null): void { ... }
```
`getSavedTransport()` now may also read type? Keep separate `getSavedPrinterType` to avoid breaking BLE device id. `index.ts` uses `getSavedPrinterType`.

**webSerial.ts:**
- Add `baudRate` constant from `getPrinterBaud()`.
- `connect()` (requestPort) + `reconnect()` (getPorts, open) use `getPrinterBaud()`.
- Wrap `port.open()` in try/catch → rethrow `new Error("Port sedang dipakai oleh aplikasi lain. Tutup aplikasi printer lalu coba lagi")` when `err?.message` matches /in use|busy/i.
- Add UI guidance string constant `SERIAL_HINT = "Pilih port 'Standard Serial over Bluetooth link' untuk printer Bluetooth Classic."` (exported for card to display? Card already has UsbIcon help text — append hint).

### Task 2: rawbt.ts + rawbt.test.ts
**File create:** `src/lib/printer/transports/rawbt.ts`
```ts
"use client";
import type { PrinterTransport } from "../types";
import { savePrinterType } from "../storage";

let configured = false;
const RAWBT_PACKAGE = "ru.a420d.rawbtprinter";
const MAX_URL = 1800; // conservative URL-safe length

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}
export function isRawbtInstalledHint(): string {
  return "Pasang app RawBT (ru.a402d.rawbtprinter) di Android, lalu pairing printer di Settings → Bluetooth.";
}

export const rawbt: PrinterTransport = {
  id: "rawbt",
  isSupported() { return isAndroid(); },
  async connect() {
    if (!isAndroid()) throw new Error("RawBT hanya tersedia di Android");
    configured = true;
    savePrinterType("rawbt");
  },
  async reconnect() { return configured; },
  async write(data) {
    if (!configured) throw new Error("Buka app RawBT terlebih dahulu (Hubungkan Printer)");
    const b64 = Array.from(data, (b) => String.fromCharCode(b % 256)).join("");
    const url = intentUrl(btoa(b64));
    if (url.length > MAX_URL) throw new Error("Nota terlalu panjang untuk RawBT. Pakai USB/COM atau turunkan jumlah item.");
    window.location.href = url;  // within user gesture from printReceipt()
  },
  async disconnect() { configured = false; },
  isConnected() { return configured; },
  deviceName() { return configured ? "RawBT (terkonfigurasi)" : null; },
};

export function intentUrl(b64: string): string {
  return `intent:${b64}#Intent;scheme=rawbt;package=${RAWBT_PACKAGE};end;`;
}
```
*(base64 of full Uint8Array via binary string. Verified against known RawBT docs pattern.)*

**Test** `src/lib/printer/transports/rawbt.test.ts`:
- `intentUrl("SGVsbG8=")` → equals `intent:SGVsbG8=#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`
- long payload > MAX_URL throws via write (mock configured + navigator) → `expect(...).rejects.toThrow(/terlalu panjang/i)`.

### Task 1: types.ts
**File:** `src/lib/printer/types.ts`
- Add `"rawbt"` to `TransportId` union.
- No other change.

## Verification (final)
- `npx tsc --noEmit`
- `npx eslint src/lib/printer src/components/pengaturan/printer-card.tsx src/components/layout/compact-menu-sheet.tsx`
- `npx vitest run src/lib/printer`
- `npx next build`

## Commit guidance (per task, smallest coherent unit)
- `feat(printer): add RawBT transport for Android Classic SPP`
- `feat(printer): configurable baudRate in Web Serial`
- `feat(printer): transport picker + platform priority`
- `feat(printer): use manual printer type in printReceipt`
- `docs: RawBT + PC Classic printing`
Each commit: `git add <touched files> && git commit -m "<msg>"` — no `--amend`, no `--rebase` during work.
