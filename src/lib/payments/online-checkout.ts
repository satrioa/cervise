import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Koneksi ke gateway pembayaran online. Semua konfigurasi ada di server;
 * UI tidak pernah menyebut nama gateway.
 */

export type CheckoutInput = {
  orderId: string;
  grossAmount: number;
  firstName: string;
  email: string;
  phone?: string | null;
  returnPath?: string;
};

export type CheckoutConfig = {
  serverKey: string;
  isProduction: boolean;
};

/**
 * Kunci sandbox selalu diawali `SB-Mid-`. Kalau flag produksi salah nyala,
 * prefix kunci tetap menang supaya request tidak dikirim ke endpoint produksi.
 */
export function resolveIsProduction(serverKey: string, flag: string | undefined): boolean {
  if (serverKey.startsWith("SB-Mid-")) return false;
  return flag === "true";
}

export function readCheckoutConfig(): CheckoutConfig | null {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) return null;
  return {
    serverKey,
    isProduction: resolveIsProduction(serverKey, process.env.MIDTRANS_IS_PRODUCTION),
  };
}

export function checkoutEndpoint(isProduction: boolean) {
  return isProduction
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";
}

export function buildCheckoutPayload(input: CheckoutInput) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kaggo.app").replace(/\/$/, "");
  const returnPath = input.returnPath?.startsWith("/") ? input.returnPath : "/app/pengaturan/usage/beli";
  const returnUrl = `${siteUrl}${returnPath}`;
  return {
    transaction_details: {
      order_id: input.orderId,
      gross_amount: input.grossAmount,
    },
    // Redirect dikirim di request supaya tidak perlu mengubah preferensi checkout di dashboard.
    callbacks: {
      finish: returnUrl,
      pending: returnUrl,
      error: returnUrl,
    },
    credit_card: { secure: true },
    customer_details: {
      first_name: input.firstName || "Pelanggan Kaggo",
      email: input.email,
      ...(input.phone ? { phone: input.phone } : {}),
    },
  };
}

export async function createCheckoutRedirect(
  input: CheckoutInput,
  config: CheckoutConfig,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(checkoutEndpoint(config.isProduction), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${config.serverKey}:`).toString("base64")}`,
      },
      body: JSON.stringify(buildCheckoutPayload(input)),
      cache: "no-store",
    });
  } catch {
    throw new Error("Gagal menghubungi gateway pembayaran. Coba lagi beberapa saat.");
  }

  const body = (await response.json().catch(() => ({}))) as {
    redirect_url?: string;
    error_messages?: string[];
  };
  if (!response.ok || !body.redirect_url) {
    // Sertakan status + pesan gateway (tanpa kunci/header) supaya penyebab
    // terlihat di toast, bukan React error #441 yang samar.
    const detail = Array.isArray(body.error_messages)
      ? body.error_messages.join("; ").slice(0, 300)
      : "";
    throw new Error(
      `Pembayaran belum bisa diproses (HTTP ${response.status})${detail ? `: ${detail}` : ""}. Hubungi admin bila berlanjut.`,
    );
  }
  return body.redirect_url;
}

export type WebhookBody = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
  transaction_id?: string;
  payment_type?: string;
};

/** SHA512(order_id + status_code + gross_amount + serverKey), dibandingkan aman. */
export function verifyWebhookSignature(body: WebhookBody, serverKey: string): boolean {
  const signature = body.signature_key;
  if (!signature || !body.order_id || !body.status_code || !body.gross_amount) return false;

  const expected = createHash("sha512")
    .update(`${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Status yang berarti pembayaran diterima dan boleh mengaktifkan kuota. */
export function isPaidWebhook(body: WebhookBody): boolean {
  const status = body.transaction_status;
  if (status !== "settlement" && status !== "capture") return false;
  return !body.fraud_status || body.fraud_status === "accept";
}
