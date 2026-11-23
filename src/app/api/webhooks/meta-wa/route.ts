import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { finalizeQuota, findIdempotencyKeyByProviderMessage } from "@/lib/payments/quota";

export const runtime = "nodejs";

type MetaStatus = {
  id?: string;
  status?: string;
  errors?: unknown[];
};

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function extractStatuses(payload: unknown): MetaStatus[] {
  const statuses: MetaStatus[] = [];
  const body = payload as {
    entry?: { changes?: { value?: { statuses?: MetaStatus[] } }[] }[];
  };
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const status of change?.value?.statuses ?? []) {
        if (status?.id) statuses.push(status);
      }
    }
  }
  return statuses;
}

/** Verifikasi subscribe dari Meta Dashboard. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (
    !token ||
    params.get("hub.mode") !== "subscribe" ||
    params.get("hub.verify_token") !== token
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return new NextResponse(params.get("hub.challenge") ?? "", { status: 200 });
}

/**
 * Webhook delivery status = sumber kebenaran untuk status kirim.
 * Event duplikat / out-of-order aman: idempotency key unik + finalisasi
 * penolakan hanya terjadi sekali (ledger `refund` punya unique reference).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const statuses = extractStatuses(payload);
  for (const status of statuses) {
    const providerMessageId = status.id!;
    const key = await findIdempotencyKeyByProviderMessage(providerMessageId);
    if (!key) continue; // pesan masuk / bukan dari sistem kita: tidak memotong kuota
    const failed = status.status === "failed" || (status.errors?.length ?? 0) > 0;
    await finalizeQuota({
      idempotencyKey: key,
      providerMessageId,
      status: failed ? "failed" : status.status ?? "delivered",
    });
  }

  return NextResponse.json({ ok: true, processed: statuses.length });
}
