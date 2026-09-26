import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mocks } = vi.hoisted(() => {
  const claimed = new Set<string>();
  const events: string[] = [];
  const sendResult: { skip?: boolean } = { skip: false };
  const sendFonnteWA = vi.fn();

  const invoiceRows = [
    {
      id: "inv-1",
      invoice_number: "INV-1",
      amount: 1000,
      period_start: "2026-01-01",
      period_end: "2026-02-01",
      organization: { id: "org-1", name: "Tenant 1", contact_phone: "0811" },
      package: { name: "Pro" },
    },
    {
      id: "inv-2",
      invoice_number: "INV-2",
      amount: 2000,
      period_start: "2026-01-01",
      period_end: "2026-02-01",
      organization: { id: "org-2", name: "Tenant 2", contact_phone: "0822" },
      package: { name: "Pro" },
    },
  ];

  const invoicesUpdate = vi.fn((values: { whatsapp_sent_at?: string | null }) => {
    let targetId = "";
    const apply = async () => {
      if (values.whatsapp_sent_at === null) {
        claimed.delete(targetId);
        events.push(`release:${targetId}`);
        return { data: [{ id: targetId }], error: null };
      }
      events.push(`claim:${targetId}`);
      if (claimed.has(targetId)) return { data: [], error: null };
      claimed.add(targetId);
      return { data: [{ id: targetId }], error: null };
    };
    const chain = {
      eq: vi.fn((_column: string, value: string) => {
        targetId = value;
        return chain;
      }),
      is: vi.fn(() => chain),
      select: vi.fn(async () => apply()),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => apply().then(resolve, reject),
    };
    return chain;
  });

  const platformSettingsQuery = {
    select: vi.fn(() => platformSettingsQuery),
    eq: vi.fn(() => platformSettingsQuery),
    maybeSingle: vi.fn(async () => ({ data: { owner_whatsapp: "0899" }, error: null })),
  };

  const admin = {
    rpc: vi.fn(async () => ({ data: [], error: null })),
    from: vi.fn((table: string) => {
      if (table === "invoices") {
        return {
          update: invoicesUpdate,
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ eq: vi.fn(() => ({ is: vi.fn(async () => ({ data: invoiceRows, error: null })) })) })),
          })),
        };
      }
      if (table === "platform_settings") return platformSettingsQuery;
      throw new Error(`unexpected table: ${table}`);
    }),
  };

  return {
    mocks: {
      claimed,
      events,
      admin,
      invoiceRows,
      invoicesUpdate,
      sendFonnteWA,
      sendResult,
      isAuthorizedCronRequest: vi.fn(() => true),
    },
  };
});

vi.mock("@/lib/cron-auth", () => ({ isAuthorizedCronRequest: mocks.isAuthorizedCronRequest }));
vi.mock("@/lib/fonnte", () => ({ sendFonnteWA: mocks.sendFonnteWA }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mocks.admin }));
vi.mock("@/lib/billing/renewal", () => ({
  buildRenewalWhatsAppMessage: () => "message",
  buildWhatsAppUrl: () => "https://wa.me/0899",
}));

function request() {
  return new Request("http://localhost/api/cron/subscription-renewals");
}

describe("subscription renewal cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claimed.clear();
    mocks.events.length = 0;
    mocks.sendResult.skip = false;
    mocks.sendFonnteWA.mockImplementation(async (phone: string) => {
      mocks.events.push(`send:${phone}`);
      return mocks.sendResult;
    });
  });

  it("claims each invoice before sending a whatsapp", async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(body).toEqual({ sent: 2, skipped: 0, failed: 0 });
    expect(mocks.events).toEqual(["claim:inv-1", "send:0811", "claim:inv-2", "send:0822"]);
  });

  it("skips invoices already claimed by a concurrent run", async () => {
    mocks.claimed.add("inv-1");

    const response = await GET(request());
    const body = await response.json();

    expect(body).toEqual({ sent: 1, skipped: 1, failed: 0 });
    expect(mocks.sendFonnteWA).toHaveBeenCalledTimes(1);
  });

  it("releases the claim when sending fails", async () => {
    mocks.sendFonnteWA.mockImplementation(async (phone: string) => {
      mocks.events.push(`send:${phone}`);
      if (phone === "0811") throw new Error("fonnte down");
      return { skip: false };
    });

    const response = await GET(request());
    const body = await response.json();

    expect(body).toEqual({ sent: 1, skipped: 0, failed: 1 });
    expect(mocks.claimed.has("inv-1")).toBe(false);
    expect(mocks.claimed.has("inv-2")).toBe(true);
  });

  it("releases the claim when sending is skipped by configuration", async () => {
    mocks.sendResult.skip = true;

    const response = await GET(request());
    const body = await response.json();

    expect(body).toEqual({ sent: 0, skipped: 2, failed: 0 });
    expect(mocks.claimed.size).toBe(0);
  });

  it("rejects unauthorized requests", async () => {
    mocks.isAuthorizedCronRequest.mockReturnValue(false);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.admin.rpc).not.toHaveBeenCalled();
  });
});
