import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionPayload = {
  employeeId: string;
  organizationId: string;
  branchId: string | null;
  name: string;
  exp: number;
};

function signature(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signature(body, secret)}`;
}

export function verifySession(
  token: string | undefined,
  secret: string,
): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = signature(body, secret);
  const actualBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (
      typeof payload.employeeId !== "string" ||
      typeof payload.organizationId !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp <= Date.now()
    ) return null;
    return payload;
  } catch {
    return null;
  }
}
