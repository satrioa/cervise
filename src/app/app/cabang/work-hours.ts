const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validWorkHours(checkIn: string, checkOut: string): boolean {
  if (!HHMM.test(checkIn) || !HHMM.test(checkOut)) return false;
  return checkIn < checkOut;
}
