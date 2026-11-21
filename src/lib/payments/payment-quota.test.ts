import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { quotaLevel, walletSummary } from "./quota";
import {
  ACTIVE_PAYMENT_PROVIDER,
  PAYMENT_PROVIDERS,
  getDuitkuCheckout,
  isProviderCheckoutAvailable,
} from "./provider";
import { parseTopupPackageInput } from "@/lib/platform/validation";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261121130000_centralized_payment_wa_quota.sql"),
  "utf8",
);

describe("payment provider", () => {
  it("hanya transfer manual yang aktif; Duitku tidak pernah checkout", () => {
    expect(ACTIVE_PAYMENT_PROVIDER.id).toBe("manual_transfer");
    expect(isProviderCheckoutAvailable("manual_transfer")).toBe(true);
    expect(isProviderCheckoutAvailable("duitku")).toBe(false);
    expect(PAYMENT_PROVIDERS.find((p) => p.id === "duitku")?.notice).toBe(
      "NOT CONFIGURED / PENDING MERCHANT APPROVAL",
    );
    expect(() => getDuitkuCheckout()).toThrow(/belum dikonfigurasi/);
  });
});

describe("wallet shared tenant", () => {
  it("included dipakai sebelum top-up dan ringkasan menjumlahkan keduanya", () => {
    const summary = walletSummary({
      organization_id: "o1",
      included_limit: 1500,
      included_used: 960,
      topup_balance: 500,
      period_start: "2026-11-01",
      period_end: "2026-12-01",
    });
    expect(summary.included).toBe(1500);
    expect(summary.used).toBe(960);
    expect(summary.remainingIncluded).toBe(540);
    expect(summary.topup).toBe(500);
    expect(summary.totalAvailable).toBe(1040);
  });

  it("top-up tetap ada walau included habis", () => {
    const summary = walletSummary({
      organization_id: "o1",
      included_limit: 100,
      included_used: 100,
      topup_balance: 250,
      period_start: "2026-11-01",
      period_end: "2026-12-01",
    });
    expect(summary.remainingIncluded).toBe(0);
    expect(summary.totalAvailable).toBe(250);
    expect(quotaLevel(100, 100)).toBe("exhausted");
  });

  it("ambang peringatan 80/90/100", () => {
    expect(quotaLevel(100, 79)).toBe("ok");
    expect(quotaLevel(100, 80)).toBe("warning");
    expect(quotaLevel(100, 90)).toBe("critical");
    expect(quotaLevel(100, 100)).toBe("exhausted");
  });
});

describe("config paket top-up", () => {
  it("hanya menerima jumlah pesan & harga positif", () => {
    const valid = parseTopupPackageInput({
      code: "WA 500", name: "500 pesan", messageQuantity: "500", priceIdr: "150000",
    });
    expect(valid).toMatchObject({ code: "wa-500", messageQuantity: 500, priceIdr: 150000 });
    expect(() => parseTopupPackageInput({ code: "x", name: "x", messageQuantity: 0, priceIdr: 1 })).toThrow(/jumlah pesan/i);
    expect(() => parseTopupPackageInput({ code: "x", name: "x", messageQuantity: 1, priceIdr: 0 })).toThrow(/harga/i);
  });
});

describe("migrasi Kuota & pembayaran", () => {
  it("mempunyai tabel wallet, log, ledger, fulfillment, dan bukti", () => {
    for (const table of [
      "whatsapp_quota_wallets",
      "whatsapp_usage_logs",
      "whatsapp_quota_ledger",
      "payment_fulfillments",
      "payment_proofs",
      "wa_topup_packages",
    ]) {
      expect(migration, `${table} tidak dibuat`).toContain(`create table if not exists public.${table}`);
    }
  });

  it("mengunci idempotensi, RLS, dan reset yang tidak menghapus top-up", () => {
    expect(migration).toContain("idempotency_key text not null unique");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("wa_quota_reserve");
    expect(migration).toContain("wa_quota_release");
    expect(migration).toContain("wa_quota_reset");
    expect(migration).toContain("platform_retry_fulfillment");
    // Reset hanya menyentuh included; tidak ada penulisan topup_balance = 0.
    expect(migration).not.toContain("topup_balance = 0");
    expect(migration).toContain("'topup'");
  });

  it("unlimited karyawan & tiket, branch limit tidak diubah", () => {
    expect(migration).toContain("set user_limit = null, ticket_quota = null");
    expect(migration).not.toContain("drop trigger if exists branches_enforce_subscription_limit");
  });
});
