// Integrasi WhatsApp via Fonnte - fetch ringan, tanpa dependency.
//
// Fonnte membalas HTTP 200 dengan body { "status": false } saat kehabisan
// kuota atau target tidak valid. Hanya mengecek res.ok akan melaporkan
// kegagalan itu sebagai sukses, jadi body harus diperiksa juga.

export type FonnteSendResult =
  | { skip: true }
  | { skip: false; status: true; detail: Record<string, unknown> };

export class FonnteError extends Error {
  readonly reason: string;
  readonly retryable: boolean;

  constructor(reason: string, retryable: boolean) {
    super(`Fonnte gagal: ${reason}`);
    this.name = "FonnteError";
    this.reason = reason;
    this.retryable = retryable;
  }
}

// Alasan yang tidak akan berubah kalau dikirim ulang: nomor tidak valid,
// parameter salah, token ditolak. Selain daftar ini, apa pun dianggap
// sementara: kehabisan kuota, jaringan, HTTP 5xx, 429.
const PERMANENT_REASONS = [
  "invalid target",
  "invalid parameter",
  "invalid country code",
  "token invalid",
  "token expired",
  "unauthorized",
  "forbidden",
];

function isPermanentReason(reason: string): boolean {
  const normalized = reason.trim().toLowerCase();
  return PERMANENT_REASONS.some((candidate) => normalized.includes(candidate));
}

// Tanpa alasan dari body, kode HTTP yang jadi penentu. 429 dan 5xx pasti
// sementara. 4xx lainnya permanen: token salah atau permintaan tidak valid
// tidak akan berubah kalau dikirim ulang.
function isPermanentStatus(status: number): boolean {
  if (status >= 500) return false;
  if (status === 429) return false;
  return status >= 400;
}

export async function sendFonnteWA(
  phone: string,
  message: string,
  countryCode?: string,
): Promise<FonnteSendResult> {
  const token = process.env.FONNTE_TOKEN;
  if (!token) return { skip: true };

  const body = new URLSearchParams({ target: phone, message });
  if (countryCode) body.set("countryCode", countryCode);

  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: token,
    },
    body,
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (!res.ok || payload.status === false) {
    const bodyReason =
      typeof payload.reason === "string" && payload.reason ? payload.reason : null;
    const reason = bodyReason ?? `HTTP ${res.status}`;
    const permanent = bodyReason
      ? isPermanentReason(bodyReason)
      : isPermanentStatus(res.status);
    throw new FonnteError(reason, !permanent);
  }

  return { skip: false, status: true, detail: payload };
}
