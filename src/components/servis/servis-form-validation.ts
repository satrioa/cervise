export type ServisFormValues = {
  teknisiId: string;
  merk: string;
  tipe: string;
  custName: string;
  custPhone: string;
  kerusakan?: string[];
  passwordType?: "PIN" | "POLA";
  passwordValue?: string;
  garansiVal?: number | "";
  priceEstimasi?: number | "";
};

export type FieldErrors = Record<string, string>;

/** Ambil pesan pertama untuk banner; field tetap ditandai satu per satu. */
export function firstFieldError(errors: FieldErrors): string | null {
  const first = Object.values(errors)[0];
  return first ?? null;
}

export function validateServisForm(v: ServisFormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!v.teknisiId) errors.teknisiId = "Teknisi wajib diisi";
  if (!v.merk.trim()) errors.merk = "Merk wajib";
  if (!v.tipe.trim()) errors.tipe = "Tipe wajib";
  if ((v.kerusakan ?? []).length === 0) errors.kerusakan = "Kerusakan minimal 1 tag";
  if (!v.custName.trim()) errors.custName = "Nama customer wajib";
  if (!v.custPhone.trim()) errors.custPhone = "Kontak WA wajib";
  else if (
    !/^08\d{7,13}$/.test(v.custPhone.trim()) &&
    !/^62\d{7,13}$/.test(v.custPhone.trim())
  ) {
    errors.custPhone = "Format WA tidak valid (08xxx)";
  }

  // PIN/pola & garansi opsional: hanya divalidasi kalau diisi.
  const passwordValue = v.passwordValue?.trim() ?? "";
  if (passwordValue) {
    if (v.passwordType === "PIN" && !/^\d{4,8}$/.test(passwordValue)) {
      errors.passwordValue = "PIN harus 4-8 digit angka";
    }
    if (v.passwordType === "POLA" && passwordValue.split(",").filter(Boolean).length < 4) {
      errors.passwordValue = "Pola minimal 4 titik";
    }
  }
  if (v.garansiVal !== undefined && v.garansiVal !== "" && Number(v.garansiVal) <= 0) {
    errors.garansiVal = "Garansi harus lebih dari 0";
  }
  if (v.priceEstimasi !== undefined && v.priceEstimasi !== "" && Number(v.priceEstimasi) < 0) {
    errors.priceEstimasi = "Estimasi tidak valid";
  }
  return errors;
}
