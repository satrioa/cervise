import { describe, expect, it } from "vitest";
import { mapCustomerRows, type CustomerInput, type CustomerServiceInput } from "./customer-list";

function customer(overrides: Partial<CustomerInput> = {}): CustomerInput {
  return { id: "c1", name: "Citra", phone: "628123456789", created_at: "2025-01-10T03:00:00.000Z", ...overrides };
}

function service(overrides: Partial<CustomerServiceInput> = {}): CustomerServiceInput {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    service_number: "SRV-2026-0001",
    customer_id: "c1",
    status: "Selesai",
    created_at: "2026-09-21T04:00:00.000Z",
    price: 350_000,
    ...overrides,
  };
}

describe("mapCustomerRows", () => {
  it("returns an empty list when there are no customers", () => {
    expect(mapCustomerRows({ customers: [], services: [] })).toEqual([]);
  });

  it("formats the phone for display without losing the normalised digits", () => {
    const [row] = mapCustomerRows({ customers: [customer()], services: [] });

    expect(row.phone).toBe("628123456789");
    expect(row.phoneDisplay).toBe("0812 3456 789");
  });

  it("converts a leading zero phone to 62", () => {
    const [row] = mapCustomerRows({ customers: [customer({ phone: "08123456789" })], services: [] });

    expect(row.phone).toBe("628123456789");
    expect(row.phoneDisplay).toBe("0812 3456 789");
  });

  it("labels a missing phone instead of rendering an empty cell", () => {
    const [row] = mapCustomerRows({ customers: [customer({ phone: "" })], services: [] });
    expect(row.phoneDisplay).toBe("—");
  });

  it("counts the customer's services and sums their price", () => {
    const [row] = mapCustomerRows({
      customers: [customer()],
      services: [
        service({ id: "a", price: 350_000 }),
        service({ id: "b", price: 120_500 }),
      ],
    });

    expect(row.totalServis).toBe(2);
    expect(row.totalSpent).toBe(470_500);
  });

  it("ignores services belonging to another customer", () => {
    const [row] = mapCustomerRows({
      customers: [customer()],
      services: [service({ customer_id: "someone-else" })],
    });

    expect(row.totalServis).toBe(0);
    expect(row.totalSpent).toBe(0);
  });

  it("treats a null price as zero rather than NaN", () => {
    const [row] = mapCustomerRows({ customers: [customer()], services: [service({ price: null })] });
    expect(row.totalSpent).toBe(0);
  });

  it("uses the newest service for the last-service columns", () => {
    const [row] = mapCustomerRows({
      customers: [customer()],
      services: [
        service({ id: "old", service_number: "SRV-1", created_at: "2026-01-05T04:00:00.000Z" }),
        service({ id: "new", service_number: "SRV-2", created_at: "2026-09-21T04:00:00.000Z" }),
      ],
    });

    expect(row.lastServis).toBe("SRV-2");
    expect(row.lastStatus).toBe("Selesai");
  });

  it("prefers the real service number over a uuid prefix", () => {
    const [row] = mapCustomerRows({ customers: [customer()], services: [service()] });
    expect(row.lastServis).toBe("SRV-2026-0001");
  });

  it("falls back to a short id when a service has no number yet", () => {
    const [row] = mapCustomerRows({
      customers: [customer()],
      services: [service({ service_number: null, id: "abcdef12-3456" })],
    });

    expect(row.lastServis).toBe("ABCDEF12");
  });

  it("marks a customer with no services as never serviced", () => {
    const [row] = mapCustomerRows({ customers: [customer()], services: [] });

    expect(row.lastServis).toBe("—");
    expect(row.lastStatus).toBe("—");
    expect(row.lastDate).toBe("—");
    expect(row.lastDateRaw).toBeNull();
  });

  it("keeps the raw timestamps alongside the formatted labels", () => {
    const [row] = mapCustomerRows({ customers: [customer()], services: [service()] });

    expect(row.createdAtRaw).toBe("2025-01-10T03:00:00.000Z");
    expect(row.lastDateRaw).toBe("2026-09-21T04:00:00.000Z");
  });
});
