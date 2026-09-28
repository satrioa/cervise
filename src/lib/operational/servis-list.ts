export type ServisStage = "Masuk" | "Diagnosa" | "Menunggu Konfirmasi" | "Menunggu Sparepart" | "Dikerjakan" | "Selesai" | "Sudah Diambil" | "Batal";
export type ServisPaymentStatus = "Lunas" | "DP" | "Belum dibayar";

/**
 * Label yang ditampilkan ke pengguna untuk sebuah servis.
 *
 * Nomor servis (SRV-2026-0001) yang dipakai, bukan UUID dari kolom id. Tabel
 * sempat merender {item.id} mentah sehingga pengguna melihat
 * "211bd56f-0845-48f5-..." di kolom "Servis". UUID tetap jadi cadangan untuk
 * data lama yang belum punya service_number, dipotong 8 karakter supaya tetap
 * terbaca.
 */
export function servisLabel(item: { id: string; serviceNumber?: string | null }): string {
  // String kosong harus diperlakukan sama dengan null. Kalau hanya memakai
  // ??, baris dengan service_number yang kosong akan menampilkan kolom kosong,
  // bukan id pendek.
  const serviceNumber = item.serviceNumber?.trim();
  return serviceNumber ? serviceNumber : item.id.slice(0, 8).toUpperCase();
}

export type ServisServiceInput = {
  id: string;
  service_number: string | null;
  tracking_code: string | null;
  device: string;
  complaint: string | null;
  status: string;
  price: number;
  customer_id: string | null;
  teknisi_id: string | null;
  created_at: string;
};

export type ServisListRow = {
  id: string;
  serviceNumber: string | null;
  trackingCode: string | null;
  device: string;
  customer: string;
  price: number;
  teknisi: string;
  status: ServisStage;
  complaint: string;
  date: string;
  payment: ServisPaymentStatus;
  paidAmount: number;
};

export function mapServisListRows(input: {
  services: ServisServiceInput[];
  customers: { id: string; name: string; phone: string | null }[];
  profiles: { id: string; full_name: string | null }[];
  finance: { servis_id: string; amount: number }[];
}): ServisListRow[] {
  const customers = new Map(input.customers.map((customer) => [customer.id, customer]));
  const profiles = new Map(input.profiles.map((profile) => [profile.id, profile]));
  const paidByService = new Map<string, number>();
  for (const transaction of input.finance) {
    paidByService.set(transaction.servis_id, (paidByService.get(transaction.servis_id) ?? 0) + Number(transaction.amount ?? 0));
  }

  return input.services.map((service) => {
    const customer = service.customer_id ? customers.get(service.customer_id) : null;
    const teknisi = service.teknisi_id ? profiles.get(service.teknisi_id) : null;
    const paidAmount = paidByService.get(service.id) ?? 0;
    const payment: ServisPaymentStatus = service.price > 0 && paidAmount >= service.price ? "Lunas" : paidAmount > 0 ? "DP" : "Belum dibayar";
    return {
      id: service.id,
      serviceNumber: service.service_number ?? null,
      trackingCode: service.tracking_code ? service.tracking_code.toUpperCase() : null,
      device: service.device,
      customer: `${customer?.name ?? "Tanpa nama"} · ${customer?.phone ?? "—"}`,
      price: Number(service.price ?? 0),
      teknisi: teknisi?.full_name ?? "—",
      status: service.status as ServisStage,
      complaint: service.complaint ?? "",
      date: service.created_at.slice(0, 10),
      payment,
      paidAmount,
    };
  });
}
