import { slugify } from "../tenant-slug";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function normalizePhone(value: unknown) {
  let digits = asString(value).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}

export function parseCreateTenantInput(input: {
  name?: unknown;
  slug?: unknown;
  ownerEmail?: unknown;
  ownerPhone?: unknown;
}) {
  const name = asString(input.name);
  if (!name || name.length > 120) {
    throw new Error("Tenant name is required");
  }

  const ownerEmail = asString(input.ownerEmail).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    throw new Error("Owner email is invalid");
  }

  const ownerPhone = normalizePhone(input.ownerPhone);
  if (ownerPhone.length < 10 || ownerPhone.length > 15) {
    throw new Error("Owner phone is invalid");
  }

  const slug = slugify(asString(input.slug) || name);
  if (slug.length < 3) {
    throw new Error("Tenant slug is invalid");
  }

  return { name, slug, ownerEmail, ownerPhone };
}

export function parsePackageInput(input: {
  code?: unknown;
  name?: unknown;
  description?: unknown;
  monthlyPrice?: unknown;
  branchLimit?: unknown;
  userLimit?: unknown;
}) {
  const code = slugify(asString(input.code));
  const name = asString(input.name);
  const description = asString(input.description) || null;
  const monthlyPrice = asInteger(input.monthlyPrice);
  const branchLimit = asInteger(input.branchLimit);
  const userLimit = asInteger(input.userLimit);

  if (!code || !name) {
    throw new Error("Package code and name are required");
  }
  if (monthlyPrice === null || Number.isNaN(monthlyPrice) || monthlyPrice < 0) {
    throw new Error("Monthly price must be zero or greater");
  }
  if (branchLimit === null || Number.isNaN(branchLimit) || branchLimit < 1) {
    throw new Error("Branch limit must be at least one");
  }
  if (userLimit !== null && (Number.isNaN(userLimit) || userLimit < 1)) {
    throw new Error("User limit must be at least one");
  }

  return {
    code,
    name,
    description,
    monthlyPrice,
    branchLimit,
    userLimit,
  };
}

export function parseInvoiceDecisionInput(invoiceId: unknown, note: unknown) {
  const normalizedInvoiceId = asString(invoiceId);
  const normalizedNote = asString(note);

  if (!normalizedInvoiceId) {
    throw new Error("Invoice id is required");
  }
  if (normalizedNote.length < 3) {
    throw new Error("Decision note must be at least 3 characters");
  }

  return { invoiceId: normalizedInvoiceId, note: normalizedNote };
}
