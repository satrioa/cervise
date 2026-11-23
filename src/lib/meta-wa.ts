// Integrasi WhatsApp Cloud API (Meta). Fetch ringan, tanpa dependency.
// Pesan business-initiated wajib memakai template yang sudah disetujui Meta,
// jadi pengirim ini hanya menerima nama template + parameter bernama.

// Meta mensyaratkan nama variabel huruf kecil/angka/garis bawah, dan payload
// menyertakan `parameter_name` supaya urutan tidak lagi menentukan.
export type TemplateParameter = { type: "text"; parameter_name: string; value: string };

export type MetaWaResult =
  | { skip: true }
  | { skip: false; status: true; detail: Record<string, unknown> };

const MESSAGE_SCOPED_CODES = new Set([100, 131009, 131026, 132001]);

/**
 * `message` = nomor, parameter, atau template yang salah; mengulangnya tidak
 * akan berhasil. `infrastructure` = token/akun Meta/jaringan yang bermasalah;
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
  const n = Number(code);
  if (Number.isFinite(n) && MESSAGE_SCOPED_CODES.has(n)) return true;
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
  // Nomor tenant dikirim eksplisit oleh dispatcher. Default env dipakai tenant
  // yang belum punya nomor sendiri, supaya perilaku lama tetap berjalan.
  phoneNumberId: string = process.env.META_WA_PHONE_NUMBER_ID ?? "",
  language: "id" | "en" = "id",
  // Nilai untuk {{1}} pada URL button template (mis. servis_masuk_v2).
  // Bukan URL penuh: Meta menggantungkannya ke URL tetap di template.
  buttonValue: string = "",
  // Template dengan placeholder di header (mis. servis_baru_teknisi_v1).
  header?: { parameter_name: string; value: string },
): Promise<MetaWaResult> {
  const token = process.env.META_WA_ACCESS_TOKEN;
  const senderId = phoneNumberId.trim();
  if (!token || !senderId || !templateName) return { skip: true };

  let res: Response;
  try {
    res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(senderId)}/messages`,
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
            language: { code: language },
            components: [
              ...(header
                ? [
                    {
                      type: "header",
                      parameters: [
                        { type: "text", parameter_name: header.parameter_name, text: header.value },
                      ],
                    },
                  ]
                : []),
              {
                type: "body",
                // Builder internal memakai `value`; Graph API Meta mensyaratkan `text`.
                parameters: parameters.map(({ type, parameter_name, value }) => ({
                  type,
                  parameter_name,
                  text: value,
                })),
              },
              ...(buttonValue
                ? [
                    {
                      type: "button",
                      sub_type: "url",
                      index: "0",
                      parameters: [{ type: "text", text: buttonValue }],
                    },
                  ]
                : []),
            ],
          },
        }),
      },
    );
  } catch (err) {
    throw new MetaWaError(err instanceof Error ? err.message : String(err), "infrastructure");
  }

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

/**
 * Dipakai halaman owner saat menyimpan nomor tenant. Memastikan ID benar-benar
 * nomor yang bisa diakses token kita, bukan menerima ID asal-asalan yang nanti
 * baru gagal di antrean pengiriman.
 */
export async function verifyMetaPhoneNumber(phoneNumberId: string): Promise<string | null> {
  const token = process.env.META_WA_ACCESS_TOKEN;
  const senderId = phoneNumberId.trim();
  if (!token || !senderId) throw new Error("META_WA_ACCESS_TOKEN belum diset");

  let res: Response;
  try {
    res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(senderId)}?fields=id,display_name,verified_name`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch (err) {
    throw new MetaWaError(err instanceof Error ? err.message : String(err), "infrastructure");
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  const apiError = payload.error as { message?: unknown; code?: unknown } | undefined;
  if (!res.ok || apiError || typeof payload.id !== "string") {
    const rawReason =
      typeof apiError?.message === "string" && apiError.message ? apiError.message : null;
    const reason = rawReason ?? `HTTP ${res.status}`;
    throw new MetaWaError(
      reason,
      isMessageScoped(apiError?.code, rawReason) ? "message" : "infrastructure",
    );
  }

  return typeof payload.display_name === "string" ? payload.display_name : null;
}
