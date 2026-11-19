import {
  attendanceStatus,
  ATTENDANCE_STATUS_LABEL,
  type AttendanceStatus,
} from "@/lib/attendance/status";
import { publicPhotoUrl } from "@/lib/photos";

export type RekapRow = {
  id: string;
  tanggal: string;
  nama: string;
  cabang: string;
  jamMasuk: string;
  jamPulang: string;
  status: AttendanceStatus;
  statusLabel: string;
  selfieUrl: string | null;
  lokasi: string;
  catatan: string;
};

type RawRow = {
  id: string;
  attendance_date: string;
  employee_id: string;
  branch_id: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_selfie_path: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  note: string | null;
  full_name: string | null;
  branch_name: string | null;
  check_in_time: string;
  check_out_time: string;
};

const time = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit",
      }).format(new Date(value))
    : "-";

export function toRekapRow(r: RawRow): RekapRow {
  const status = attendanceStatus({
    checkInAt: r.check_in_at,
    checkOutAt: r.check_out_at,
    checkInTime: r.check_in_time,
    checkOutTime: r.check_out_time,
  });
  return {
    id: r.id,
    tanggal: r.attendance_date,
    nama: r.full_name ?? r.employee_id,
    cabang: r.branch_name ?? r.branch_id,
    jamMasuk: time(r.check_in_at),
    jamPulang: time(r.check_out_at),
    status,
    statusLabel: ATTENDANCE_STATUS_LABEL[status],
    selfieUrl: publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", r.check_in_selfie_path),
    lokasi: r.check_out_lat === null ? "Tidak tersedia" : `${r.check_out_lat}, ${r.check_out_lng}`,
    catatan: r.note ?? "",
  };
}
