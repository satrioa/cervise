import { redirect } from "next/navigation";

// Halaman lama. Katalog sparepart/inventori kini dilayani /app/inventori yang
// berjalan di atas cervise_products; modul /app/sparepart lama memakai schema
// inventory_* yang sudah tidak ada dan sudah dihapus.
export default function LegacySparepartPage() {
  redirect("/app/inventori");
}
