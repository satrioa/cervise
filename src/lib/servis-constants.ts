export const KONDISI_ITEMS = [
  "Battery",
  "Screen",
  "Speaker",
  "Face ID",
  "Camera",
  "Button Volume",
  "Signal",
  "Port Charging",
  "Button On/Off",
  "Mic",
  "Backglass & Backdoor",
] as const;

export type KondisiStatus = "normal" | "tidak_normal";
export type KondisiAwal = Record<string, { status: KondisiStatus; note: string }>;

export const KELENGKAPAN_DEFAULT = [
  "SIM Card",
  "Sim Tray",
  "SoftCase",
  "Memory Card",
  "Charger",
  "Box",
] as const;
