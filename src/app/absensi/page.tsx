import { getActiveTenantForAttendance } from "@/lib/supabase/actor";
import { wibDate } from "@/lib/attendance/status";
import { AbsensiClient } from "./absensi-client";

export const dynamic = "force-dynamic";

export default async function AbsensiPage() {
  const actor = await getActiveTenantForAttendance();
  const today = wibDate(new Date());
  const { data: record, error } = await actor.supabase
    .from("attendance_records")
    .select("check_in_at, check_out_at, check_in_selfie_path, check_out_selfie_path, note")
    .eq("organization_id", actor.orgId)
    .eq("employee_id", actor.employeeId)
    .eq("attendance_date", today)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const branchName =
    actor.branchOptions?.find((b) => b.id === actor.branchId)?.label ?? actor.branchId ?? "-";

  return (
    <AbsensiClient
      name={actor.fullName ?? "Karyawan"}
      branchName={branchName}
      date={today}
      checkInAt={record?.check_in_at ?? null}
      checkOutAt={record?.check_out_at ?? null}
      note={record?.note ?? null}
    />
  );
}
