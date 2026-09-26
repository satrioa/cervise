export type TrialProgressInput = {
  now: Date;
  startedAt: Date | null;
  endsAt: Date | null;
};

export type TrialProgress = {
  totalDays: number;
  remainingDays: number;
  elapsedPercent: number;
  isExpired: boolean;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function getTrialProgress(input: TrialProgressInput): TrialProgress | null {
  if (!input.endsAt) return null;

  const start = input.startedAt ?? input.now;
  const totalDays = Math.max(1, Math.round((input.endsAt.getTime() - start.getTime()) / DAY_IN_MS));
  const remainingMs = input.endsAt.getTime() - input.now.getTime();
  const isExpired = remainingMs <= 0;
  const remainingDays = isExpired ? 0 : Math.ceil(remainingMs / DAY_IN_MS);
  const elapsedPercent = isExpired
    ? 100
    : Math.min(100, Math.max(0, Math.round(((totalDays - remainingMs / DAY_IN_MS) / totalDays) * 100)));

  return { totalDays, remainingDays, elapsedPercent, isExpired };
}
