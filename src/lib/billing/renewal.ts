export type SubscriptionLifecycleStatus =
  | "trial"
  | "active"
  | "grace"
  | "blocked"
  | "suspended"
  | "cancelled";

export type RenewalInvoiceInput = {
  currentPeriodEnd: Date;
  now: Date;
  leadDays: number;
  invoiceExists: boolean;
  status: SubscriptionLifecycleStatus;
};

export type SubscriptionAccessInput = {
  status: SubscriptionLifecycleStatus;
  currentPeriodEnd: Date;
  graceDays: number;
  now: Date;
};

export type RenewalMessageInput = {
  tenantName: string;
  tenantId: string;
  packageName: string;
  invoiceId: string;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function addOneCalendarMonth(value: Date) {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const day = value.getUTCDate();
  const hours = value.getUTCHours();
  const minutes = value.getUTCMinutes();
  const seconds = value.getUTCSeconds();
  const milliseconds = value.getUTCMilliseconds();
  const targetMonth = month + 1;
  const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      year,
      targetMonth,
      Math.min(day, lastDay),
      hours,
      minutes,
      seconds,
      milliseconds,
    ),
  );
}

function formatIndonesianDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function formatRupiah(value: number) {
  return `Rp${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

export function shouldCreateRenewalInvoice(input: RenewalInvoiceInput) {
  if (
    input.invoiceExists ||
    (input.status !== "active" && input.status !== "grace")
  ) {
    return false;
  }

  const renewalWindowOpensAt =
    input.currentPeriodEnd.getTime() - input.leadDays * DAY_IN_MS;
  return input.now.getTime() >= renewalWindowOpensAt;
}

export function getSubscriptionAccessState(
  input: SubscriptionAccessInput,
): SubscriptionLifecycleStatus {
  if (
    input.status === "trial" ||
    input.status === "blocked" ||
    input.status === "suspended" ||
    input.status === "cancelled"
  ) {
    return input.status;
  }

  const graceEndsAt =
    input.currentPeriodEnd.getTime() + input.graceDays * DAY_IN_MS;

  if (input.now.getTime() >= graceEndsAt) {
    return "blocked";
  }

  if (input.now.getTime() >= input.currentPeriodEnd.getTime()) {
    return "grace";
  }

  return "active";
}

export function getEffectiveMonthlyPrice(
  packagePrice: number,
  customPrice: number | null,
) {
  return customPrice !== null &&
    Number.isFinite(customPrice) &&
    customPrice >= 0
    ? customPrice
    : packagePrice;
}

export function calculateApprovedSubscriptionPeriod(
  currentPeriodEnd: Date,
  approvedAt: Date,
) {
  const startsAt =
    approvedAt.getTime() <= currentPeriodEnd.getTime()
      ? new Date(currentPeriodEnd)
      : new Date(approvedAt);

  return {
    startsAt,
    endsAt: addOneCalendarMonth(startsAt),
  };
}

export function buildRenewalWhatsAppMessage(input: RenewalMessageInput) {
  return [
    `Halo Kak, saya mau renew paket ${input.packageName} untuk ${input.tenantName} (${input.tenantId}).`,
    "",
    `ID Invoice: ${input.invoiceId}`,
    `Harga: ${formatRupiah(input.amount)}`,
    `Periode renewal: ${formatIndonesianDate(input.periodStart)} s.d. ${formatIndonesianDate(input.periodEnd)}`,
    "",
    "Saya akan melakukan transfer sesuai nominal di atas. Mohon konfirmasi setelah pembayaran diterima. Terima kasih!",
  ].join("\n");
}

export function buildWhatsAppUrl(ownerPhone: string, message: string) {
  let digits = ownerPhone.replace(/\D/g, "");

  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith("8")) {
    digits = `62${digits}`;
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
