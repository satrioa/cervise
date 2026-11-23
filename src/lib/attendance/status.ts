export type AttendanceStatus =
  | "HADIR"
  | "TERLAMBAT"
  | "PULANG_AWAL"
  | "BELUM_PULANG"
  | "BELUM_MASUK";

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  HADIR: "Hadir",
  TERLAMBAT: "Terlambat",
  PULANG_AWAL: "Pulang awal",
  BELUM_PULANG: "Belum pulang",
  BELUM_MASUK: "Belum masuk",
};

const WIB = "Asia/Jakarta";

function asDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** Tanggal (YYYY-MM-DD) menurut WIB — dipakai sebagai attendance_date. */
export function wibDate(value: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(asDate(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Jam WIB dalam menit sejak 00:00. */
export function wibMinutes(value: Date | string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: WIB, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(asDate(value));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

export function attendanceStatus(row: {
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInTime: string;
  checkOutTime: string;
}): AttendanceStatus {
  if (!row.checkInAt) return "BELUM_MASUK";
  if (!row.checkOutAt) return "BELUM_PULANG";
  if (wibMinutes(row.checkInAt) > timeToMinutes(row.checkInTime)) return "TERLAMBAT";
  if (wibMinutes(row.checkOutAt) < timeToMinutes(row.checkOutTime)) return "PULANG_AWAL";
  return "HADIR";
}
