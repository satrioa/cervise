import { createClient } from "@/lib/supabase/server";

export type AppRole = "MASTER_ADMIN" | "ADMIN" | "FRONTLINER" | "TECHNICIAN";

export type AppNotificationEvent =
  | "servis_created"
  | "servis_selesai"
  | "pembayaran_servis"
  | "pembayaran_penjualan"
  | "request_stok_sparepart"
  | "stok_alert"
  | "sparepart_habis"
  | "buka_toko"
  | "tutup_toko";

export type NotifyRolesInput = {
  organizationId: string;
  branchId: string;
  branchLabel: string;
  event: AppNotificationEvent;
  roles: AppRole[];
  title: string;
  body: string;
  href?: string | null;
};

/** Tulis satu notifikasi untuk sekelompok role. Gagal menulis tidak boleh menggagalkan mutasi utama. */
export async function notifyRoles(input: NotifyRolesInput): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("cervise_app_notifications").insert({
      organization_id: input.organizationId,
      branch_id: input.branchId,
      branch_label: input.branchLabel,
      event: input.event,
      audience_roles: input.roles,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
    });
    if (error) console.error("[notifications] insert failed:", error.message);
  } catch (error) {
    console.error("[notifications] helper failed:", error);
  }
}
