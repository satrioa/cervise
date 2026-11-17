export type CardTargetType = "penghasilan" | "jumlah_servis";
export type CardFlags = { showTarget: boolean; showIntensif: boolean };

export function technicianCardFlags(input: {
  insentifEnabled: boolean;
  intensifMode: string;
  showTarget: boolean;
  showIntensif: boolean;
}): CardFlags {
  if (!input.insentifEnabled) return { showTarget: false, showIntensif: false };
  return {
    showTarget: input.showTarget,
    showIntensif: input.showIntensif && input.intensifMode !== "flat",
  };
}

export function targetProgress(input: {
  type: CardTargetType;
  value: number | null;
  selesai: number;
  penghasilan: number;
}): { current: number; target: number; percent: number } {
  const target = Math.max(0, Math.trunc(input.value ?? 0));
  const current =
    input.type === "penghasilan"
      ? Math.max(0, Math.round(input.penghasilan))
      : Math.max(0, Math.trunc(input.selesai));
  return {
    current,
    target,
    percent: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
  };
}

export function insentifEstimate(input: {
  mode: string;
  value: number;
  selesai: number;
  penghasilan: number;
}): number {
  if (input.mode === "fixed") return Math.max(0, input.selesai * input.value);
  if (input.mode === "percent") return Math.round((Math.max(0, input.penghasilan) * input.value) / 100);
  return 0;
}
