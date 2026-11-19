"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateCustomMonthlyPrice,
  configFromPackageRow,
  normalizeCustomInput,
  yearlyPrice,
  type CustomPricingInput,
} from "./v2";
import { buildCustomQuoteWhatsAppUrl } from "@/lib/custom-package-whatsapp";

export type PublicPackage = {
  code: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number | null;
  branch_limit: number;
  user_limit: number | null;
  ticket_quota: number | null;
  whatsapp_quota: number | null;
  trial_days: number | null;
  is_recommended: boolean;
  sort_order: number;
  extra_branch_price: number | null;
  extra_employee_price: number | null;
  extra_ticket_block_price: number | null;
  ticket_block_size: number | null;
  wa_per_ticket_block: number | null;
  annual_multiplier: number | null;
};

export async function getPublicPackages(): Promise<PublicPackage[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("packages")
    .select("code, name, description, monthly_price, annual_price, branch_limit, user_limit, ticket_quota, whatsapp_quota, trial_days, is_recommended, sort_order, extra_branch_price, extra_employee_price, extra_ticket_block_price, ticket_block_size, wa_per_ticket_block, annual_multiplier")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PublicPackage[];
}

export type CustomQuote = {
  ok: boolean;
  message: string;
  input?: CustomPricingInput;
  monthly?: number;
  annual?: number;
  whatsappQuota?: number;
  url?: string;
};

/** Harga Custom dihitung ulang di server, bukan dipercaya dari frontend. */
export async function requestCustomQuote(raw: CustomPricingInput): Promise<CustomQuote> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("packages")
    .select("monthly_price, branch_limit, user_limit, ticket_quota, whatsapp_quota, extra_branch_price, extra_employee_price, extra_ticket_block_price, ticket_block_size, wa_per_ticket_block, annual_multiplier")
    .eq("code", "custom")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, message: "Paket Custom belum dikonfigurasi." };

  const config = configFromPackageRow(data);
  const input = normalizeCustomInput(
    {
      branches: Number(raw?.branches),
      employees: Number(raw?.employees),
      services: Number(raw?.services),
    },
    config,
  );
  const breakdown = calculateCustomMonthlyPrice(input, config);
  const annual = yearlyPrice(breakdown.total, config);

  return {
    ok: true,
    message: "Estimasi dihitung ulang oleh server dari konfigurasi paket Custom.",
    input,
    monthly: breakdown.total,
    annual,
    whatsappQuota: breakdown.whatsappQuota,
    url: buildCustomQuoteWhatsAppUrl(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP, {
      ...input,
      monthly: breakdown.total,
      annual,
      whatsappQuota: breakdown.whatsappQuota,
    }),
  };
}
