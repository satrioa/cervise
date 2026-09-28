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
  readonly scope: "message" | "infrastructure";

  /**
   * `message` = nomor atau isi pesannya yang salah, jadi mengulangnya tidak
   * akan pernah berhasil. `infrastructure` = Fonnte atau tokennya yang bermasalah,
   * jadi pesannya sendiri masih layak dicoba begitu masalahnya beres.
   *
   * Bedanya penting karena satu token dipakai semua tenant: saat token
   * kedaluwarsa, Fonnte membalas 401 untuk setiap pesan sekaligus. Kalau itu
   * diperlakukan permanen, satu rotasi token membuang semua notifikasi tanpa
   * jejak.
   *
   * `retryable` tidak jadi parameter: ia diturunkan dari `scope`, supaya tidak
   * mungkin ada error yang sekaligus terminal tapi terbaca retryable.
   */
  readonly retryable: boolean;

  constructor(reason: string, scope: "message" | "infrastructure") {
    super(`Fonnte gagal: ${reason}`);
    this.name = "FonnteError";
    this.reason = reason;
    this.scope = scope;
    this.retryable = scope !== "message";
  }
}

// Status HTTP tanpa alasan Fonnte tidak pernah bisa dipastikan itu soal nomor
// atau soal token, jadi tidak dipakai untuk memutuskan terminal. Yang menentukan
// hanya alasan Fonnte sendiri: kalau Fonnte menyebut alasannya, itu soal pesan;
// kalau tidak, itu soal infrastruktur dan pesannya masih layak dicoba.

// Alasan yang menunjuk ke nomor atau isi pesan, jadi mengulangnya tidak akan
// pernah berhasil. Selain daftar ini, apa pun dianggap sementara:
// kehabisan kuota, jaringan, HTTP 5xx, 429, penolakan token.
const PERMANENT_REASONS = [
  "invalid target",
  "invalid parameter",
  "invalid country code",
  "target not valid",
  "message too long",
];

function isPermanentReason(reason: string): boolean {
  const normalized = reason.trim().toLowerCase();
  return PERMANENT_REASONS.some((candidate) => normalized.includes(candidate));
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

    // Hanya alasan dari Fonnte yang bisa menyalahkan pesan. Tanpa alasan, kita
    // tidak tahu apakah nomornya salah atau tokennya yang kedaluwarsa, dan
    // mengulanginya lebih aman daripada membuang notifikasi.
    const messageScoped = bodyReason ? isPermanentReason(bodyReason) : false;

    throw new FonnteError(reason, messageScoped ? "message" : "infrastructure");
  }

  return { skip: false, status: true, detail: payload };
}
