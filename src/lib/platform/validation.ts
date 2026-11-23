import { slugify } from "../tenant-slug";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function asBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return value === "true" || value === "1";
}

function normalizePhone(value: unknown) {
  let digits = asString(value).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}

/** Paket top-up WA: owner menentukan jumlah pesan & harga IDR. Tidak ada hardcode. */
export function parseTopupPackageInput(input: {
  id?: unknown;
  code?: unknown;
  name?: unknown;
  messageQuantity?: unknown;
  priceIdr?: unknown;
  isActive?: unknown;
  sortOrder?: unknown;
}) {
  const id = asString(input.id) || null;
  const code = slugify(asString(input.code));
  const name = asString(input.name);
  const messageQuantity = asInteger(input.messageQuantity);
  const priceIdr = asInteger(input.priceIdr);
  const isActive = asBoolean(input.isActive, true);
  const sortOrder = asInteger(input.sortOrder) ?? 0;

  if (!code || !name) throw new Error("Kode dan nama paket wajib diisi");
  if (messageQuantity === null || Number.isNaN(messageQuantity) || messageQuantity < 1) {
    throw new Error("Jumlah pesan harus lebih dari nol");
  }
  if (priceIdr === null || Number.isNaN(priceIdr) || priceIdr < 1) {
    throw new Error("Harga harus lebih dari nol");
  }
  return { id, code, name, messageQuantity, priceIdr, isActive, sortOrder };
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
  annualPrice?: unknown;
  trialDays?: unknown;
  ticketQuota?: unknown;
  whatsappQuota?: unknown;
  extraBranchPrice?: unknown;
  extraTicketBlockPrice?: unknown;
  ticketBlockSize?: unknown;
  waPerTicketBlock?: unknown;
  annualMultiplier?: unknown;
  isActive?: unknown;
  sortOrder?: unknown;
  isRecommended?: unknown;
}) {
  const code = slugify(asString(input.code));
  const name = asString(input.name);
  const description = asString(input.description) || null;
  const monthlyPrice = asInteger(input.monthlyPrice);
  const branchLimit = asInteger(input.branchLimit);
  const annualPrice = asInteger(input.annualPrice);
  const trialDays = asInteger(input.trialDays);
  const ticketQuota = asInteger(input.ticketQuota);
  const whatsappQuota = asInteger(input.whatsappQuota);
  const extraBranchPrice = asInteger(input.extraBranchPrice) ?? 79000;
  const extraTicketBlockPrice = asInteger(input.extraTicketBlockPrice) ?? 199000;
  const ticketBlockSize = asInteger(input.ticketBlockSize) ?? 100;
  const waPerTicketBlock = asInteger(input.waPerTicketBlock) ?? 300;
  const annualMultiplier = asInteger(input.annualMultiplier) ?? 10;
  const sortOrder = asInteger(input.sortOrder) ?? 0;
  const isActive = asBoolean(input.isActive, true);
  const isRecommended = asBoolean(input.isRecommended, false);

  if (!code || !name) {
    throw new Error("Package code and name are required");
  }
  if (monthlyPrice === null || Number.isNaN(monthlyPrice) || monthlyPrice < 0) {
    throw new Error("Monthly price must be zero or greater");
  }
  if (branchLimit === null || Number.isNaN(branchLimit) || branchLimit < 1) {
    throw new Error("Branch limit must be at least one");
  }
  if (annualPrice !== null && (Number.isNaN(annualPrice) || annualPrice < 0)) {
    throw new Error("Annual price must be zero or greater");
  }
  if (trialDays !== null && (Number.isNaN(trialDays) || trialDays < 1)) {
    throw new Error("Trial days must be at least one");
  }
  for (const [value, label] of [
    [ticketQuota, "Ticket quota"],
    [whatsappQuota, "WhatsApp quota"],
  ] as const) {
    if (value !== null && (Number.isNaN(value) || value < 0)) {
      throw new Error(`${label} must be zero or greater`);
    }
  }
  for (const [value, label] of [
    [extraBranchPrice, "Extra branch price"],
    [extraTicketBlockPrice, "Extra ticket block price"],
    [waPerTicketBlock, "WhatsApp per ticket block"],
    [annualMultiplier, "Annual multiplier"],
  ] as const) {
    if (Number.isNaN(value) || value < 0) {
      throw new Error(`${label} must be zero or greater`);
    }
  }
  if (!Number.isInteger(ticketBlockSize) || ticketBlockSize < 1) {
    throw new Error("Ticket block size must be at least one");
  }
  if (Number.isNaN(sortOrder)) {
    throw new Error("Sort order must be an integer");
  }

  return {
    code,
    name,
    description,
    monthlyPrice,
    branchLimit,
    annualPrice,
    trialDays,
    ticketQuota,
    whatsappQuota,
    extraBranchPrice,
    extraTicketBlockPrice,
    ticketBlockSize,
    waPerTicketBlock,
    annualMultiplier,
    isActive,
    sortOrder,
    isRecommended,
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
