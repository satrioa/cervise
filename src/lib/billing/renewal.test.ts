import { describe, expect, it } from "vitest";
import {
  addCalendarMonths,
  buildRenewalWhatsAppMessage,
  buildWhatsAppUrl,
  calculateApprovedSubscriptionPeriod,
  getEffectiveMonthlyPrice,
  getSubscriptionAccessState,
  resolveSubscriptionAccessState,
  shouldCreateRenewalInvoice,
} from "./renewal";

const iso = (value: string) => new Date(value);

describe("shouldCreateRenewalInvoice", () => {
  const base = {
    currentPeriodEnd: iso("2026-10-31T00:00:00.000Z"),
    now: iso("2026-10-24T00:00:00.000Z"),
    leadDays: 7,
    invoiceExists: false,
    status: "active" as const,
  };

  it("opens the renewal window exactly at H-7", () => {
    expect(shouldCreateRenewalInvoice(base)).toBe(true);
  });

  it("does not open before H-7", () => {
    expect(
      shouldCreateRenewalInvoice({
        ...base,
        now: iso("2026-10-23T23:59:59.999Z"),
      }),
    ).toBe(false);
  });

  it("catches up an overdue active subscription", () => {
    expect(
      shouldCreateRenewalInvoice({
        ...base,
        now: iso("2026-11-02T00:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("does not create a duplicate invoice", () => {
    expect(shouldCreateRenewalInvoice({ ...base, invoiceExists: true })).toBe(false);
  });

  it.each(["trial", "blocked", "suspended", "cancelled"] as const)(
    "does not renew a %s subscription",
    (status) => {
      expect(shouldCreateRenewalInvoice({ ...base, status })).toBe(false);
    },
  );
});

describe("getSubscriptionAccessState", () => {
  it("keeps a paid subscription active through its period", () => {
    expect(
      getSubscriptionAccessState({
        status: "active",
        currentPeriodEnd: iso("2026-10-31T00:00:00.000Z"),
        graceDays: 3,
        now: iso("2026-10-30T23:59:59.999Z"),
      }),
    ).toBe("active");
  });

  it("moves an overdue subscription into grace", () => {
    expect(
      getSubscriptionAccessState({
        status: "active",
        currentPeriodEnd: iso("2026-10-31T00:00:00.000Z"),
        graceDays: 3,
        now: iso("2026-11-01T00:00:00.000Z"),
      }),
    ).toBe("grace");
  });

  it("blocks a subscription after grace expires", () => {
    expect(
      getSubscriptionAccessState({
        status: "grace",
        currentPeriodEnd: iso("2026-10-31T00:00:00.000Z"),
        graceDays: 3,
        now: iso("2026-11-04T00:00:00.000Z"),
      }),
    ).toBe("blocked");
  });

  it("preserves trial and manual lifecycle states", () => {
    expect(
      getSubscriptionAccessState({
        status: "trial",
        currentPeriodEnd: iso("2026-10-31T00:00:00.000Z"),
        graceDays: 3,
        now: iso("2026-10-01T00:00:00.000Z"),
      }),
    ).toBe("trial");
    expect(
      getSubscriptionAccessState({
        status: "suspended",
        currentPeriodEnd: iso("2026-10-31T00:00:00.000Z"),
        graceDays: 3,
        now: iso("2026-10-01T00:00:00.000Z"),
      }),
    ).toBe("suspended");
  });
});

describe("getEffectiveMonthlyPrice", () => {
  it("uses the tenant custom price when present", () => {
    expect(getEffectiveMonthlyPrice(199_000, 175_000)).toBe(175_000);
  });

  it("falls back to the package price", () => {
    expect(getEffectiveMonthlyPrice(199_000, null)).toBe(199_000);
  });
});

describe("addCalendarMonths", () => {
  it("clamps month-end instead of rolling into the next month", () => {
    expect(addCalendarMonths(iso("2026-01-31T00:00:00.000Z"), 1).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
  });

  it("adds multiple months from the same base", () => {
    expect(addCalendarMonths(iso("2026-01-31T00:00:00.000Z"), 3).toISOString()).toBe(
      "2026-04-30T00:00:00.000Z",
    );
  });
});

describe("resolveSubscriptionAccessState", () => {
  const now = iso("2026-11-10T00:00:00.000Z");

  it("keeps an active subscription active before the period ends", () => {
    expect(
      resolveSubscriptionAccessState({
        status: "active",
        currentPeriodEnd: iso("2026-12-09T00:00:00.000Z"),
        trialEndsAt: null,
        graceDays: 3,
        now,
      }),
    ).toBe("active");
  });

  it("reports grace after the period end but before grace expires", () => {
    expect(
      resolveSubscriptionAccessState({
        status: "active",
        currentPeriodEnd: iso("2026-11-09T00:00:00.000Z"),
        trialEndsAt: null,
        graceDays: 3,
        now,
      }),
    ).toBe("grace");
  });

  it("blocks an active subscription whose grace has expired", () => {
    expect(
      resolveSubscriptionAccessState({
        status: "active",
        currentPeriodEnd: iso("2026-11-01T00:00:00.000Z"),
        trialEndsAt: null,
        graceDays: 3,
        now,
      }),
    ).toBe("blocked");
  });

  it("uses trial_ends_at for trial tenants", () => {
    expect(
      resolveSubscriptionAccessState({
        status: "trial",
        currentPeriodEnd: null,
        trialEndsAt: iso("2026-11-20T00:00:00.000Z"),
        graceDays: 0,
        now,
      }),
    ).toBe("trial");
    expect(
      resolveSubscriptionAccessState({
        status: "trial",
        currentPeriodEnd: null,
        trialEndsAt: iso("2026-11-01T00:00:00.000Z"),
        graceDays: 0,
        now,
      }),
    ).toBe("blocked");
  });

  it("keeps an explicit suspension regardless of dates", () => {
    expect(
      resolveSubscriptionAccessState({
        status: "suspended",
        currentPeriodEnd: iso("2027-01-01T00:00:00.000Z"),
        trialEndsAt: null,
        graceDays: 3,
        now,
      }),
    ).toBe("suspended");
  });
});

describe("calculateApprovedSubscriptionPeriod", () => {
  it("starts an on-time renewal at the current period end", () => {
    const period = calculateApprovedSubscriptionPeriod(
      iso("2026-10-31T00:00:00.000Z"),
      iso("2026-10-25T00:00:00.000Z"),
    );

    expect(period.startsAt.toISOString()).toBe("2026-10-31T00:00:00.000Z");
    expect(period.endsAt.toISOString()).toBe("2026-11-30T00:00:00.000Z");
  });

  it("starts a late approval at the approval time", () => {
    const period = calculateApprovedSubscriptionPeriod(
      iso("2026-10-31T00:00:00.000Z"),
      iso("2026-11-02T09:30:00.000Z"),
    );

    expect(period.startsAt.toISOString()).toBe("2026-11-02T09:30:00.000Z");
    expect(period.endsAt.toISOString()).toBe("2026-12-02T09:30:00.000Z");
  });
});

describe("buildRenewalWhatsAppMessage", () => {
  it("contains the tenant, package, invoice, amount, and period", () => {
    const message = buildRenewalWhatsAppMessage({
      tenantName: "Cervise Retail",
      tenantId: "11111111-1111-1111-1111-111111111111",
      packageName: "Pro",
      invoiceId: "INV-2026-001",
      amount: 499_000,
      periodStart: iso("2026-10-31T00:00:00.000Z"),
      periodEnd: iso("2026-11-30T00:00:00.000Z"),
    });

    expect(message).toContain("Cervise Retail");
    expect(message).toContain("11111111-1111-1111-1111-111111111111");
    expect(message).toContain("Pro");
    expect(message).toContain("INV-2026-001");
    expect(message).toContain("Rp499.000");
    expect(message).toContain("31 Oktober 2026");
    expect(message).toContain("30 November 2026");
  });
});

describe("buildWhatsAppUrl", () => {
  it("normalizes the phone number and preserves the message", () => {
    const message = "Halo Kak, saya mau renew paket Pro.";
    const result = buildWhatsAppUrl("+62 812-3456-7890", message);
    const url = new URL(result);

    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/6281234567890");
    expect(url.searchParams.get("text")).toBe(message);
  });
});
