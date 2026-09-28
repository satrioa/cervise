import { afterEach, describe, expect, it, vi } from "vitest";
import { FonnteError, sendFonnteWA } from "./fonnte";

const originalToken = process.env.FONNTE_TOKEN;

afterEach(() => {
  if (originalToken === undefined) {
    delete process.env.FONNTE_TOKEN;
  } else {
    process.env.FONNTE_TOKEN = originalToken;
  }
  vi.unstubAllGlobals();
});

describe("sendFonnteWA", () => {
  it("skips sending when Fonnte is not configured", async () => {
    delete process.env.FONNTE_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendFonnteWA("6281234567890", "Halo")).resolves.toEqual({
      skip: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the target and message as form data", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendFonnteWA("6281234567890", "Halo Kak"),
    ).resolves.toEqual({
      skip: false,
      status: true,
      detail: { status: true },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.fonnte.com/send",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "test-token" },
      }),
    );

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    const body = options.body as URLSearchParams;
    expect(body.get("target")).toBe("6281234567890");
    expect(body.get("message")).toBe("Halo Kak");
  });

  it("throws when Fonnte returns a non-2xx response", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: false }), { status: 500 }),
      ),
    );

    await expect(sendFonnteWA("6281234567890", "Halo")).rejects.toThrow(
      "Fonnte gagal: HTTP 500",
    );
  });

  it("treats HTTP 200 with status false as a failure", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ status: false, reason: "insufficient quota" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const error = await sendFonnteWA("6281234567890", "Halo").catch(
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(FonnteError);
    expect((error as FonnteError).reason).toBe("insufficient quota");
    expect((error as FonnteError).retryable).toBe(true);
  });

  it("marks an invalid target as not retryable", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ status: false, reason: "invalid target" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const error = await sendFonnteWA("0812", "Halo").catch(
      (err: unknown) => err,
    );
    expect((error as FonnteError).reason).toBe("invalid target");
    expect((error as FonnteError).retryable).toBe(false);
  });

  it("marks a rejected token as not retryable", async () => {
    // Token Fonnte dipakai bersama semua tenant, jadi token kedaluwarsa
    // menghentikan SEMUA pesan. Mengulangnya hanya membuang kuota.
    process.env.FONNTE_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 401 })),
    );

    const error = await sendFonnteWA("628123456789", "Halo").catch(
      (err: unknown) => err,
    );
    expect((error as FonnteError).reason).toBe("HTTP 401");
    expect((error as FonnteError).retryable).toBe(false);
  });

  it("keeps server errors and rate limits retryable", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 503 })),
    );
    expect(
      await sendFonnteWA("628123456789", "Halo").catch((e: unknown) => e),
    ).toMatchObject({ retryable: true });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 429 })),
    );
    expect(
      await sendFonnteWA("628123456789", "Halo").catch((e: unknown) => e),
    ).toMatchObject({ retryable: true });
  });

  it("marks a 400 with an unlisted reason as not retryable", async () => {
    // Fonnte membalas alasan sendiri, dan daftar PERMANENT_REASONS tidak
    // mungkin lengkap. Status 4xx menutupi yang terlewat.
    process.env.FONNTE_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ reason: "pesan melebihi batas" }), {
          status: 400,
        }),
      ),
    );

    const error = await sendFonnteWA("628123456789", "Halo").catch(
      (err: unknown) => err,
    );
    expect((error as FonnteError).reason).toBe("pesan melebihi batas");
    expect((error as FonnteError).retryable).toBe(false);
  });

  it("sends the country code when one is given", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendFonnteWA("6281234567890", "Halo", "62");

    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as URLSearchParams;
    expect(body.get("countryCode")).toBe("62");
  });
});
