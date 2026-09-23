"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { LocaleState } from "@/lib/localization-context";

export async function getLocale() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const uid = auth.user.id;
  const { data } = await supabase.from("profiles").select("settings").eq("id", uid).maybeSingle();
  if ((data as any)?.settings?.locale) return (data as any).settings.locale as LocaleState;
  const { data: cp } = await supabase.from("cervise_profiles").select("settings").eq("id", uid).maybeSingle();
  return ((cp as any)?.settings?.locale as LocaleState) ?? null;
}

export async function updateLocale(locale: LocaleState) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const uid = auth.user.id;

  // Validate basic shape
  const allowedLanguages = ["id-ID", "en-US", "en-GB", "fr-FR", "de-DE", "ja-JP", "zh-CN", "es-ES", "pt-BR"];
  if (!allowedLanguages.includes(locale.language)) throw new Error("Bahasa tidak valid");
  const allowedCurr = ["IDR", "USD", "EUR", "GBP", "JPY", "CAD", "AUD"];
  if (!allowedCurr.includes(locale.currency)) throw new Error("Currency tidak valid");

  // Merge into profiles.settings
  const { data: cur } = await supabase.from("profiles").select("settings").eq("id", uid).maybeSingle();
  const merged = { ...((cur as any)?.settings ?? {}), locale };
  const { error } = await supabase.from("profiles").update({ settings: merged } as any).eq("id", uid);
  if (error) throw new Error(error.message);
  // also sync cervise_profiles if exists
  const { data: cur2 } = await supabase.from("cervise_profiles").select("settings").eq("id", uid).maybeSingle();
  if (cur2) {
    const merged2 = { ...((cur2 as any)?.settings ?? {}), locale };
    await supabase.from("cervise_profiles").update({ settings: merged2 } as any).eq("id", uid);
  }
  revalidatePath("/app/pengaturan/lokalisasi");
  return { ok: true };
}
