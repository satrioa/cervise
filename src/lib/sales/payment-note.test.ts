import { describe, expect, it } from "vitest";
import { buildPaymentNote, parsePaymentNote } from "./payment-note";

describe("buildPaymentNote", () => {
  it("mencatat uang diterima dan kembalian untuk tunai", () => {
    expect(buildPaymentNote({ method: "Tunai", total: 16_650_000, cashReceived: 16_700_000 })).toBe(
      "[Tunai diterima 16.700.000 - kembali 50.000]",
    );
  });

  it("tunai tanpa uang diterima memakai total supaya tidak ada kembalian negatif", () => {
    expect(buildPaymentNote({ method: "Tunai", total: 100_000, cashReceived: 90_000 })).toContain("kembali 0");
  });

  it("merangkai bank dan nomor pada metode non-tunai", () => {
    expect(buildPaymentNote({ method: "Debit", total: 0, bank: "BCA", reference: "123456" })).toBe(
      "[Debit - BCA - Ref 123456]",
    );
    expect(
      buildPaymentNote({ method: "Transfer", total: 0, bank: "Mandiri", accountNumber: "9876", accountName: "Budi" }),
    ).toBe("[Transfer - Mandiri - 9876 - a.n. Budi]");
    expect(buildPaymentNote({ method: "E-Wallet", total: 0, wallet: "GoPay", reference: "0812" })).toBe(
      "[GoPay - 0812]",
    );
  });
});

describe("parsePaymentNote", () => {
  it("membaca kembali uang diterima dan kembalian", () => {
    const parsed = parsePaymentNote("[Promo RAMADAN] [Tunai diterima 16.700.000 - kembali 50.000]");
    expect(parsed.cashReceived).toBe(16_700_000);
    expect(parsed.change).toBe(50_000);
  });

  it("tidak tertukar dengan tag promo di depan notes", () => {
    const parsed = parsePaymentNote("[Promo RAMADAN] [Debit - BCA - Ref 123456]");
    expect(parsed.cashReceived).toBeUndefined();
    expect(parsed.detail).toBe("BCA - Ref 123456");
  });

  it("aman untuk notes kosong atau tanpa tag pembayaran", () => {
    expect(parsePaymentNote(null)).toEqual({});
    expect(parsePaymentNote("catatan bebas")).toEqual({});
    expect(parsePaymentNote("[Promo X]")).toEqual({});
  });
});
