"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { canAccess } from "@/lib/rbac";
import { applyBranchScope } from "@/lib/supabase/branch-scope";
import { revalidatePath } from "next/cache";
import { groupInventoryProducts, summarizeInventory, type InventoryGroup, type InventoryProduct, type InventorySummary } from "@/lib/operational/inventori";
import { prepareInventoriImport, type InventoriImportRow } from "@/lib/inventori/import";

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

  const query = applyBranchScope(
    actor.supabase
      .from("cervise_products")
      .select(COLUMNS),
    actor,
  );
  const { data, error } = await query
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

/**
 * Impor katalog dari file Excel. Validasi memakai aturan yang sama dengan
 * pratinjau di dialog (`prepareInventoriImport`); server mengulangnya karena
 * isi file tidak boleh dipercaya.
 */
export async function importInventori(rows: InventoriImportRow[]): Promise<{ inserted: number }> {
  const actor = await getActiveTenant();
  requireInventoryAccess(actor.role);
  // Sejalan dengan `createProduct`: yang boleh menambah katalog adalah
  // admin/frontliner, bukan teknisi yang hanya perlu melihat stok.
  if (!canAccess(actor.role, "penjualan")) throw new Error("Hanya admin/frontliner boleh impor produk");
  const branchId = actor.branchId;
  if (!branchId) throw new Error("Cabang aktif belum dipilih");
  if (rows.length === 0) throw new Error("File tidak berisi baris produk");

  const { data: existing, error: existingError } = await actor.supabase
    .from("cervise_products")
    .select("sku")
    .eq("branch_id", branchId);
  if (existingError) throw new Error(existingError.message);

  const { products, errors } = prepareInventoriImport(
    rows,
    (existing ?? []).map((row) => String(row.sku ?? "")),
  );
  if (errors.length > 0) {
    const shown = errors.slice(0, 5).join("\n");
    const rest = errors.length > 5 ? `\n… dan ${errors.length - 5} baris lain` : "";
    throw new Error(shown + rest);
  }

  for (let index = 0; index < products.length; index += 50) {
    const payload = products.slice(index, index + 50).map((product) => ({
      branch_id: branchId,
      organization_id: actor.orgId,
      ...product,
      is_serialized: product.variant_type === "BEKAS",
      is_active: true,
      bh_percent: null,
      garansi_days: null,
    }));
    const { error } = await actor.supabase.from("cervise_products").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/app/inventori");
  revalidatePath("/app/penjualan");
  return { inserted: products.length };
}
