import { afterEach, describe, expect, it, vi } from "vitest";
import { MetaWaError, sendMetaWA, verifyMetaPhoneNumber } from "./meta-wa";

const original = {
  token: process.env.META_WA_ACCESS_TOKEN,
  phoneNumberId: process.env.META_WA_PHONE_NUMBER_ID,
};

afterEach(() => {
  if (original.token === undefined) delete process.env.META_WA_ACCESS_TOKEN;
  else process.env.META_WA_ACCESS_TOKEN = original.token;
  if (original.phoneNumberId === undefined) delete process.env.META_WA_PHONE_NUMBER_ID;
  else process.env.META_WA_PHONE_NUMBER_ID = original.phoneNumberId;
  vi.unstubAllGlobals();
});

function ok(body: Record<string, unknown> = { messages: [{ id: "wamid.1" }] }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("sendMetaWA", () => {
  it("skip tanpa token", async () => {
    delete process.env.META_WA_ACCESS_TOKEN;
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendMetaWA("628123456789", "invoice", [])).resolves.toEqual({ skip: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skip tanpa phone number id", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    delete process.env.META_WA_PHONE_NUMBER_ID;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendMetaWA("628123456789", "invoice", [])).resolves.toEqual({ skip: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("memakai phone number ID yang diteruskan, bukan env", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    process.env.META_WA_PHONE_NUMBER_ID = "111111";
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);

    await sendMetaWA("628123456789", "invoice", [], "222222");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://graph.facebook.com/v21.0/222222/messages",
    );
  });

  it("skip tanpa nama template", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendMetaWA("628123456789", "", [])).resolves.toEqual({ skip: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mengirim payload template berurutan ke Graph API", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    const parameters = [
      { type: "text" as const, value: "Servisin" },
      { type: "text" as const, value: "SRV-2026-0012" },
    ];

    await expect(sendMetaWA("628123456789", "invoice", parameters)).resolves.toEqual({
      skip: false,
      status: true,
      detail: { messages: [{ id: "wamid.1" }] },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v21.0/1443653698834770/messages",
      expect.objectContaining({ method: "POST" }),
    );
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.headers).toEqual({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(options.body as string)).toEqual({
      messaging_product: "whatsapp",
      to: "628123456789",
      type: "template",
      template: {
        name: "invoice",
        language: { code: "id" },
        components: [{ type: "body", parameters }],
      },
    });
  });

  it("membalas 190 sebagai infrastructure agar token bisa di-rotate", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 190, message: "Invalid OAuth access token" } }), { status: 401 }),
      ),
    );

    const error = await sendMetaWA("628123456789", "invoice", []).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MetaWaError);
    expect((error as MetaWaError).reason).toBe("Invalid OAuth access token");
    expect((error as MetaWaError).scope).toBe("infrastructure");
    expect((error as MetaWaError).retryable).toBe(true);
  });

  it("membalas 131026 sebagai message-scoped", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 131026, message: "Message undeliverable" } }), { status: 400 }),
      ),
    );

    const error = await sendMetaWA("628123456789", "invoice", []).catch((e: unknown) => e);
    expect((error as MetaWaError).scope).toBe("message");
    expect((error as MetaWaError).retryable).toBe(false);
  });

  it("membalas template tidak ada (132001) sebagai message-scoped", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 132001, message: "Template does not exist" } }), { status: 400 }),
      ),
    );

    const error = await sendMetaWA("628123456789", "invoice", []).catch((e: unknown) => e);
    expect((error as MetaWaError).reason).toBe("Template does not exist");
    expect((error as MetaWaError).scope).toBe("message");
  });

  it("membalas 5xx tanpa body sebagai infrastructure", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));

    const error = await sendMetaWA("628123456789", "invoice", []).catch((e: unknown) => e);
    expect((error as MetaWaError).reason).toBe("HTTP 503");
    expect((error as MetaWaError).scope).toBe("infrastructure");
    expect((error as MetaWaError).retryable).toBe(true);
  });

  it("membalas kegagalan fetch sebagai infrastructure", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch failed")));

    const error = await sendMetaWA("628123456789", "invoice", []).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MetaWaError);
    expect((error as MetaWaError).reason).toBe("fetch failed");
    expect((error as MetaWaError).scope).toBe("infrastructure");
    expect((error as MetaWaError).retryable).toBe(true);
  });

  it("membalas error pada body 200 sebagai message-scoped", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    process.env.META_WA_PHONE_NUMBER_ID = "1443653698834770";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(ok({ error: { code: 131026, message: "Message undeliverable" } })),
    );

    const error = await sendMetaWA("628123456789", "invoice", []).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MetaWaError);
    expect((error as MetaWaError).scope).toBe("message");
  });
});

describe("verifyMetaPhoneNumber", () => {
  it("mengembalikan display_name untuk ID yang bisa diakses", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    const fetchMock = vi.fn().mockResolvedValue(
      ok({ id: "222222", display_name: "Servisin Cabang" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyMetaPhoneNumber("222222")).resolves.toBe("Servisin Cabang");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://graph.facebook.com/v21.0/222222?fields=id,display_name,verified_name",
    );
  });

  it("menolak ID yang tidak dikenal Meta", async () => {
    process.env.META_WA_ACCESS_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 100, message: "Invalid parameter" } }), {
          status: 400,
        }),
      ),
    );

    const error = await verifyMetaPhoneNumber("999999").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MetaWaError);
    expect((error as MetaWaError).reason).toBe("Invalid parameter");
  });
});
