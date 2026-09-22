export type UiStage = "Masuk" | "Diagnosa" | "Menunggu Konfirmasi" | "Menunggu Sparepart" | "Dikerjakan" | "Selesai" | "Sudah Diambil" | "Batal";
export type DbStatus = "received" | "diagnosed" | "waiting_approval" | "waiting_part" | "in_repair" | "quality_control" | "ready" | "picked_up" | "cancelled";

export const UI_TO_DB: Record<UiStage, DbStatus> = {
  Masuk: "received",
  Diagnosa: "diagnosed",
  "Menunggu Konfirmasi": "waiting_approval",
  "Menunggu Sparepart": "waiting_part",
  Dikerjakan: "in_repair",
  Selesai: "quality_control", // Selesai maps to QC before ready; treat as QC. Adjust if needed.
  "Sudah Diambil": "picked_up",
  Batal: "cancelled",
};

export const DB_TO_UI: Record<DbStatus, UiStage> = {
  received: "Masuk",
  diagnosed: "Diagnosa",
  waiting_approval: "Menunggu Konfirmasi",
  waiting_part: "Menunggu Sparepart",
  in_repair: "Dikerjakan",
  quality_control: "Selesai",
  ready: "Selesai",
  picked_up: "Sudah Diambil",
  cancelled: "Batal",
};

export function uiToDb(s: UiStage): DbStatus { return UI_TO_DB[s]; }
export function dbToUi(s: string): UiStage { return (DB_TO_UI as any)[s] ?? "Masuk"; }

// Rank for gating: Masuk 0 ... Batal special
export const UI_RANK: Record<UiStage, number> = {
  Masuk: 0,
  Diagnosa: 1,
  "Menunggu Konfirmasi": 2,
  "Menunggu Sparepart": 3,
  Dikerjakan: 4,
  Selesai: 5,
  "Sudah Diambil": 6,
  Batal: 99,
};

export function canAddSparepart(uiStatus: UiStage): boolean {
  // Rule per latest req: only while Dikerjakan, not after Selesai / Sudah Diambil / Batal
  return uiStatus === "Dikerjakan";
}
