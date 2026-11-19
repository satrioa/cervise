import { createAdminClient } from "@/lib/supabase/admin";
import { wibDate } from "@/lib/attendance/status";
import { readSession } from "./actions";
import { PinLogin } from "./pin-login";
import { KioskClient } from "./kiosk-client";
import { toLogRow, type LogRow } from "./kiosk-data";

export const dynamic = "force-dynamic";

export default async function AbsenKioskPage() {
  const session = await readSession();
  if (!session) return <PinLogin />;

  const today = wibDate(new Date());
  const sebulanLalu = new Date();
  sebulanLalu.setUTCDate(sebulanLalu.getUTCDate() - 29);
  const dari = wibDate(sebulanLalu);
  const admin = createAdminClient();
  // Sesi menyimpan employees.id, sedangkan attendance_records.employee_id
  // adalah profiles.id. Terjemahkan dulu supaya filter log tidak kosong.
  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("profile_id")
    .eq("id", session.employeeId)
    .maybeSingle();
  if (employeeError) throw new Error(employeeError.message);

  const { data, error } = await admin
    .from("attendance_rekap")
    .select("attendance_date, check_in_at, check_out_at, check_in_time, check_out_time")
    .eq("employee_id", employee?.profile_id ?? "")
    .gte("attendance_date", dari)
    .order("attendance_date", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);

  const rawRows = (data ?? []) as Parameters<typeof toLogRow>[0][];
  const rows: LogRow[] = rawRows.map((row) => toLogRow(row));
  return <KioskClient name={session.name} today={today} rows={rows} />;
}
