import { garansiMeta } from "./garansi-meta";

export type GaransiClaimEligibilityInput = {
  status: string;
  garansiUntil: string | null;
  garansiValue: number;
  garansiUnit: string;
  hasOpenClaim: boolean;
  now?: Date;
};

export type GaransiClaimEligibility = { eligible: boolean; reason: string };

/**
 * Satu-satunya sumber aturan klaim garansi: dipakai tombol di tabel dan action
 * server, supaya UI tidak pernah menawarkan klaim yang akan ditolak server.
 */
export function canClaimGaransi(input: GaransiClaimEligibilityInput): GaransiClaimEligibility {
  if (input.status !== "Sudah Diambil") {
    return { eligible: false, reason: "Servis belum selesai diambil" };
  }
  const now = input.now ?? new Date();
  const untilMs = input.garansiUntil ? new Date(input.garansiUntil).getTime() : NaN;
  // garansiMeta membulatkan ke hari sehingga garansi yang lewat kemarin masih
  // terbaca "0 hari" (segera_habis). Untuk klaim, lewatnya timestamp = expired.
  if (Number.isNaN(untilMs)) {
    return { eligible: false, reason: "Garansi belum aktif" };
  }
  if (untilMs < now.getTime()) {
    return { eligible: false, reason: "Garansi sudah habis" };
  }
  const meta = garansiMeta(
    {
      garansiUntil: input.garansiUntil,
      garansiValue: input.garansiValue,
      garansiUnit: input.garansiUnit,
    },
    now,
  );
  if (meta.state === "belum_aktif") {
    return { eligible: false, reason: "Garansi belum aktif" };
  }
  if (meta.state === "expired") {
    return { eligible: false, reason: "Garansi sudah habis" };
  }
  if (input.hasOpenClaim) {
    return { eligible: false, reason: "Sudah ada klaim garansi yang masih berjalan" };
  }
  return { eligible: true, reason: "" };
}
