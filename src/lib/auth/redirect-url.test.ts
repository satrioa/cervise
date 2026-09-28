import { describe, expect, it } from "vitest";
import { PASSWORD_RESET_PATH, resolveAppOrigin } from "@/lib/auth/redirect-url";

function headers(map: Record<string, string>) {
  return (name: string) => map[name] ?? null;
}

describe("resolveAppOrigin", () => {
  it("derives an https origin from the Host header", () => {
    expect(resolveAppOrigin(headers({ host: "cervise.vercel.app" }))).toBe("https://cervise.vercel.app");
  });

  it("prefers x-forwarded-host and x-forwarded-proto set by a reverse proxy", () => {
    expect(
      resolveAppOrigin(
        headers({
          host: "internal.local",
          "x-forwarded-host": "cervise.vercel.app",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://cervise.vercel.app");
  });

  it("honours an explicit x-forwarded-proto of http", () => {
    expect(resolveAppOrigin(headers({ host: "cervise.example", "x-forwarded-proto": "http" }))).toBe(
      "http://cervise.example",
    );
  });

  it("uses http for localhost so local dev does not produce an https origin", () => {
    expect(resolveAppOrigin(headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(resolveAppOrigin(headers({ host: "127.0.0.1:3000" }))).toBe("http://127.0.0.1:3000");
  });

  it("prefers NEXT_PUBLIC_SITE_URL over the request host when it is set", () => {
    expect(
      resolveAppOrigin(headers({ host: "cervise.vercel.app" }), "https://cervise.example"),
    ).toBe("https://cervise.example");
  });

  it("strips trailing slashes from the env origin", () => {
    expect(resolveAppOrigin(headers({}), "https://cervise.example///")).toBe("https://cervise.example");
  });

  it("ignores a blank env value instead of returning an empty origin", () => {
    expect(resolveAppOrigin(headers({ host: "cervise.vercel.app" }), "   ")).toBe("https://cervise.vercel.app");
  });

  it("returns null when there is no host at all, rather than a broken origin", () => {
    expect(resolveAppOrigin(headers({}))).toBeNull();
  });

  it("returns null when the host header is only whitespace", () => {
    expect(resolveAppOrigin(headers({ host: "   " }))).toBeNull();
  });
});

describe("PASSWORD_RESET_PATH", () => {
  it("points at a route inside the app, not at the Supabase domain", () => {
    expect(PASSWORD_RESET_PATH).toBe("/update-password");
    expect(PASSWORD_RESET_PATH.startsWith("/")).toBe(true);
  });
});
