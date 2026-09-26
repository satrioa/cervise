import { afterEach, describe, expect, it, vi } from "vitest";
import { sendFonnteWA } from "./fonnte";

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
    ).resolves.toEqual({ status: true });

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

  it("throws when Fonnte rejects the request", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: false }), { status: 500 }),
      ),
    );

    await expect(sendFonnteWA("6281234567890", "Halo")).rejects.toThrow(
      "Fonnte request failed",
    );
  });
});
