import { afterEach, describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./cron-auth";

const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalSecret;
  }
});

describe("isAuthorizedCronRequest", () => {
  it("accepts the exact bearer secret", () => {
    process.env.CRON_SECRET = "renewal-secret";
    const request = new Request("https://example.com/api/cron", {
      headers: { Authorization: "Bearer renewal-secret" },
    });

    expect(isAuthorizedCronRequest(request)).toBe(true);
  });

  it("rejects missing, incorrect, and unconfigured secrets", () => {
    process.env.CRON_SECRET = "renewal-secret";
    expect(isAuthorizedCronRequest(new Request("https://example.com/api/cron"))).toBe(false);
    expect(
      isAuthorizedCronRequest(
        new Request("https://example.com/api/cron", {
          headers: { Authorization: "Bearer wrong-secret" },
        }),
      ),
    ).toBe(false);

    delete process.env.CRON_SECRET;
    expect(
      isAuthorizedCronRequest(
        new Request("https://example.com/api/cron", {
          headers: { Authorization: "Bearer renewal-secret" },
        }),
      ),
    ).toBe(false);
  });
});
