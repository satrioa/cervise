export type ClosedTodaySession = {
  id: string;
  closedAt: string;
  closingBalance: number | null;
} | null;

/**
 * Dialog saldo awal hanya perlu muncul otomatis bila toko memang belum pernah
 * dibuka hari ini. Kalau shift hari ini sudah ditutup, statusnya bukan "belum
 * dibuka" — pengguna membuka shift baru lewat tombol eksplisit di dashboard.
 */
export function shouldPromptOpeningBalance(
  hasOpenSession: boolean,
  closedToday: ClosedTodaySession,
): boolean {
  return !hasOpenSession && closedToday === null;
}
