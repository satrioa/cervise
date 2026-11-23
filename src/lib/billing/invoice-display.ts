/** Status tampilan invoice: beda dengan status kolom database. */
export type InvoiceDisplayStatus = {
  label: "Lunas" | "Menunggu" | "Terlewat" | "Ditolak" | "Dibatalkan";
  variant: "success" | "warning" | "destructive" | "outline";
  paid: boolean;
};

export function displayInvoiceStatus(
  invoice: { status: string; due_date?: string | null },
  now: Date = new Date(),
): InvoiceDisplayStatus {
  if (invoice.status === "approved") return { label: "Lunas", variant: "success", paid: true };
  if (invoice.status === "voided") return { label: "Dibatalkan", variant: "outline", paid: false };
  if (invoice.status === "rejected") return { label: "Ditolak", variant: "destructive", paid: false };
  const due = invoice.due_date ? new Date(invoice.due_date) : null;
  if (due && !Number.isNaN(due.getTime()) && due.getTime() < now.getTime()) {
    return { label: "Terlewat", variant: "destructive", paid: false };
  }
  return { label: "Menunggu", variant: "warning", paid: false };
}

/** Lisensi permanen + hosting tahunan; trial bukan lisensi permanen. */
export function licenseType(packageCode: string | null | undefined): string {
  return packageCode === "trial" ? "Lisensi trial" : "Lisensi permanen · hosting tahunan";
}
