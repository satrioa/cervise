/**
 * Detail pembayaran (tunai diterima, bank, no. rekening) tidak punya kolom
 * sendiri di `cervise_sales`. Supaya tetap terbaca di riwayat dan nota, semuanya
 * dirangkai ke kolom `notes` yang sudah ada.
 *
 * Format sengaja stabil dan bisa dibaca balik `parsePaymentNote`, karena nota
 * cetak ulang hanya punya data dari database (RPC membatasi `paid` ke total,
 * jadi kembalian tidak bisa dihitung dari kolom).
 */

export type SalePaymentInput = {
  method: string;
  total: number;
  cashReceived?: number | null;
  bank?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  reference?: string | null;
  wallet?: string | null;
};

export type ParsedPaymentNote = {
  cashReceived?: number;
  change?: number;
  /** Sisa keterangan setelah nama metode, mis. "BCA - Ref 123". */
  detail?: string;
};

const rupiah = (value: number) => new Intl.NumberFormat("id-ID").format(Math.round(value));

const part = (value: string | null | undefined) => String(value ?? "").trim();

export function buildPaymentNote(payment: SalePaymentInput): string {
  const method = part(payment.method);
  const chunks: string[] = [];

  if (method === "Tunai") {
    const received = Number(payment.cashReceived ?? payment.total);
    const change = Math.max(0, received - Number(payment.total));
    chunks.push(`Tunai diterima ${rupiah(received)}`, `kembali ${rupiah(change)}`);
  } else if (method === "Debit") {
    chunks.push("Debit");
    if (part(payment.bank)) chunks.push(part(payment.bank));
    if (part(payment.reference)) chunks.push(`Ref ${part(payment.reference)}`);
  } else if (method === "Transfer") {
    chunks.push("Transfer");
    if (part(payment.bank)) chunks.push(part(payment.bank));
    if (part(payment.accountNumber)) chunks.push(part(payment.accountNumber));
    if (part(payment.accountName)) chunks.push(`a.n. ${part(payment.accountName)}`);
  } else if (method === "E-Wallet") {
    chunks.push(part(payment.wallet) || "E-Wallet");
    if (part(payment.reference)) chunks.push(part(payment.reference));
  } else {
    chunks.push(method || "Pembayaran");
    if (part(payment.reference)) chunks.push(`Ref ${part(payment.reference)}`);
  }

  return `[${chunks.join(" - ")}]`;
}

/**
 * Ambil keterangan pembayaran dari `notes`. RPC menambahkan `[Promo ...]` di
 * depan, jadi segmen Promo diabaikan dan segmen terakhir yang dipakai.
 */
export function parsePaymentNote(notes: string | null | undefined): ParsedPaymentNote {
  const segments = [...String(notes ?? "").matchAll(/\[([^\]]+)\]/g)]
    .map((match) => match[1].trim())
    .filter((segment) => segment !== "" && !/^promo\b/i.test(segment));
  const segment = segments.at(-1);
  if (!segment) return {};

  const cash = /^Tunai diterima ([\d.,]+) - kembali ([\d.,]+)$/i.exec(segment);
  if (cash) {
    const toNumber = (text: string) => Number(text.replace(/[^\d]/g, ""));
    return { cashReceived: toNumber(cash[1]), change: toNumber(cash[2]), detail: "Tunai" };
  }

  const [, ...rest] = segment.split(" - ");
  return { detail: rest.length ? rest.join(" - ") : "" };
}
