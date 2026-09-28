"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { canAccess } from "@/lib/rbac";
import { groupInventoryProducts, summarizeInventory, type InventoryGroup, type InventoryProduct, type InventorySummary } from "@/lib/operational/inventori";

/**
 * Batas keras jumlah baris. Halaman inventori menampilkan seluruh katalog,
 * jadi berbeda dari autocomplete di POS yang memang cukup 40 baris. Query
 * tanpa batas bisa diam-diam memotong produk saat katalog bertambah, jadi
 * plafonnya eksplisit dan ditandai lewat flag `truncated`.
 */
const INVENTORY_ROW_CAP = 5000;

export type InventoriData = {
  groups: InventoryGroup[];
  summary: InventorySummary;
  /** True kalau query kena plafon dan mungkin ada produk yang tidak ditampilkan. */
  truncated: boolean;
};

const COLUMNS =
  "id, name, sku, barcode, category, stock_qty, cost, price, variant_type, storage, warna, bh_percent, kondisi_notes, garansi_days, imei, parent_key, is_active";

function requireInventoryAccess(role: string) {
  if (!canAccess(role, "inventory")) throw new Error("Hanya admin yang boleh melihat inventori");
}

export async function getInventori(): Promise<InventoriData> {
  const actor = await getActiveTenant();
  requireInventoryAccess(actor.role);
  if (!actor.branchId) throw new Error("Branch not set for tenant");

  const { data, error } = await actor.supabase
    .from("cervise_products")
    .select(COLUMNS)
    .eq("branch_id", actor.branchId)
    .order("parent_key", { ascending: true })
    .order("variant_type", { ascending: true })
    .order("name")
    // Ambil satu baris lebih banyak dari plafon supaya `truncated` bisa
    // dibedakan dari katalog yang tepat di batas.
    .limit(INVENTORY_ROW_CAP + 1)
    // Sama seperti halaman inventori sebelumnya: hanya produk aktif yang
    // ditampilkan, supaya angka stok tidak bercampur dengan arsip.
    .eq("is_active", true);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as InventoryProduct[];
  const truncated = rows.length > INVENTORY_ROW_CAP;
  const capped = truncated ? rows.slice(0, INVENTORY_ROW_CAP) : rows;

  const groups = groupInventoryProducts(capped);
  return { groups, summary: summarizeInventory(groups), truncated };
}
