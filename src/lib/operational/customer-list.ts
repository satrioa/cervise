export type CustomerInput = {
  id: string;
  name: string;
  phone: string | null;
  created_at: string;
};

export type CustomerServiceInput = {
  id: string;
  service_number: string | null;
  customer_id: string | null;
  status: string;
  created_at: string;
  price: number | null;
};

export type CustomerListRow = {
  id: string;
  name: string;
  phone: string;
  phoneDisplay: string;
  createdAt: string;
  createdAtRaw: string;
  totalServis: number;
  totalSpent: number;
  lastServis: string;
  lastStatus: string;
  lastDate: string;
  lastDateRaw: string | null;
};

const NO_VALUE = "—";

// Dates are rendered in the tenant's timezone on purpose, so a service created
// late in the evening is not filed under the previous day.
const DISPLAY_TIME_ZONE = "Asia/Jakarta";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: DISPLAY_TIME_ZONE,
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return NO_VALUE;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return NO_VALUE;
  return dateFormatter.format(date);
}

export function normalizePhone62(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  return digits;
}

export function formatPhoneDisplay(norm62: string): string {
  if (!norm62.startsWith("62")) return norm62 || NO_VALUE;
  const local = `0${norm62.slice(2)}`;
  return local.replace(/(\d{4})(\d{4})(\d+)/, "$1 $2 $3").trim();
}

function serviceLabel(service: CustomerServiceInput): string {
  const number = service.service_number?.trim();
  if (number) return number;
  return String(service.id ?? "").slice(0, 8).toUpperCase() || NO_VALUE;
}

export function mapCustomerRows(input: {
  customers: CustomerInput[];
  services: CustomerServiceInput[];
}): CustomerListRow[] {
  const byCustomer = new Map<string, CustomerServiceInput[]>();
  for (const service of input.services) {
    if (!service.customer_id) continue;
    const bucket = byCustomer.get(service.customer_id);
    if (bucket) bucket.push(service);
    else byCustomer.set(service.customer_id, [service]);
  }

  return input.customers.map((customer) => {
    const services = (byCustomer.get(customer.id) ?? [])
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));

    const totalServis = services.length;
    const totalSpent = services.reduce((sum, service) => {
      const price = Number(service.price ?? 0);
      return sum + (Number.isFinite(price) ? price : 0);
    }, 0);

    const last = services[0];
    const phone = normalizePhone62(customer.phone);

    return {
      id: customer.id,
      name: customer.name,
      phone,
      phoneDisplay: phone ? formatPhoneDisplay(phone) : NO_VALUE,
      createdAt: formatDate(customer.created_at),
      createdAtRaw: customer.created_at,
      totalServis,
      totalSpent: Math.round(totalSpent),
      lastServis: last ? serviceLabel(last) : NO_VALUE,
      lastStatus: last ? last.status : NO_VALUE,
      lastDate: last ? formatDate(last.created_at) : NO_VALUE,
      lastDateRaw: last?.created_at ?? null,
    };
  });
}
