import { describe, expect, it } from "vitest";
import {
  parseCreateTenantInput,
  parseInvoiceDecisionInput,
  parsePackageInput,
} from "./validation";

describe("parseCreateTenantInput", () => {
  it("normalizes a valid tenant and Indonesian phone number", () => {
    expect(
      parseCreateTenantInput({
        name: "  Cervise Retail  ",
        slug: "",
        ownerEmail: "owner@example.com",
        ownerPhone: "+62 812-3456-7890",
      }),
    ).toEqual({
      name: "Cervise Retail",
      slug: "cervise-retail",
      ownerEmail: "owner@example.com",
      ownerPhone: "6281234567890",
    });
  });

  it("rejects missing names, invalid emails, and invalid phones", () => {
    expect(() => parseCreateTenantInput({ name: "", ownerEmail: "owner@example.com", ownerPhone: "6281234567890" })).toThrow("Tenant name is required");
    expect(() => parseCreateTenantInput({ name: "Tenant", ownerEmail: "invalid", ownerPhone: "6281234567890" })).toThrow("Owner email is invalid");
    expect(() => parseCreateTenantInput({ name: "Tenant", ownerEmail: "owner@example.com", ownerPhone: "123" })).toThrow("Owner phone is invalid");
  });
});

describe("parsePackageInput", () => {
  it("parses positive pricing and branch limits", () => {
    expect(
      parsePackageInput({
        code: "pro",
        name: "Pro",
        description: "Multi-cabang",
        monthlyPrice: "499000",
        branchLimit: "3",
        userLimit: "15",
      }),
    ).toEqual({
      code: "pro",
      name: "Pro",
      description: "Multi-cabang",
      monthlyPrice: 499000,
      branchLimit: 3,
      userLimit: 15,
    });
  });

  it("rejects negative prices and invalid branch limits", () => {
    expect(() => parsePackageInput({ code: "pro", name: "Pro", monthlyPrice: "-1", branchLimit: "3" })).toThrow("Monthly price must be zero or greater");
    expect(() => parsePackageInput({ code: "pro", name: "Pro", monthlyPrice: "1", branchLimit: "0" })).toThrow("Branch limit must be at least one");
  });
});

describe("parseInvoiceDecisionInput", () => {
  it("requires an invoice id and a meaningful rejection reason", () => {
    expect(parseInvoiceDecisionInput("invoice-1", "  paid  ")).toEqual({
      invoiceId: "invoice-1",
      note: "paid",
    });
    expect(() => parseInvoiceDecisionInput("", "paid")).toThrow("Invoice id is required");
    expect(() => parseInvoiceDecisionInput("invoice-1", "x")).toThrow("Decision note must be at least 3 characters");
  });
});
