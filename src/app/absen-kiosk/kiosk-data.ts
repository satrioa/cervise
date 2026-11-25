import {
  attendanceStatus,
  ATTENDANCE_STATUS_LABEL,
  type AttendanceStatus,
} from "@/lib/attendance/status";
import { shiftDuration } from "@/lib/operational/shift-detail";

export type LogRow = {
  tanggal: string;
  jamMasuk: string | null;
  jamPulang: string | null;
  checkInTime: string;
  checkOutTime: string;
};

export function toLogRow(r: {
  attendance_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_time: string;
  check_out_time: string;
}): LogRow {
  return {
    tanggal: r.attendance_date,
    jamMasuk: r.check_in_at,
    jamPulang: r.check_out_at,
    checkInTime: r.check_in_time,
    checkOutTime: r.check_out_time,
  };
}

export function logStatus(row: LogRow): AttendanceStatus {
  return attendanceStatus({
    checkInAt: row.jamMasuk,
    checkOutAt: row.jamPulang,
    checkInTime: row.checkInTime,
    checkOutTime: row.checkOutTime,
  });
}

export const logStatusLabel = (status: AttendanceStatus) => ATTENDANCE_STATUS_LABEL[status];

export const jam = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit",
      }).format(new Date(value))
    : "-";

/** Durasi kerja hari ini: sampai jam pulang, atau sampai `now` kalau belum pulang. */
export function workDuration(row: LogRow | undefined, now: number): string | null {
  if (!row?.jamMasuk) return null;
  const selesai = row.jamPulang ? new Date(row.jamPulang).getTime() : now;
  if (!selesai) return null;
  return shiftDuration((selesai - new Date(row.jamMasuk).getTime()) / 60_000);
}
