/** Util murni untuk konten & countdown Special Promo (bisa diuji tanpa DB). */

export function parsePromoList(value: string): string[] | null {
  const items = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (items.length === 0 || items.some((item) => item.length > 160)) return null;
  return items;
}

export type PromoCountdown = {
  ended: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function promoCountdown(endsAt: string, now: Date = new Date()): PromoCountdown {
  const remaining = new Date(endsAt).getTime() - now.getTime();
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return { ended: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    ended: false,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}
