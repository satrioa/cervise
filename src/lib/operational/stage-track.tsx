import {
  BanIcon,
  CheckIcon,
  CircleDotIcon,
  ClockIcon,
  PackageIcon,
  SearchIcon,
  TruckIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * Tahapan servis. Nilai ini persis yang disimpan di kolom
 * `cervise_services.status` (lihat CHECK constraint di migration 130000),
 * jadi tidak ada konversi dari/to snake_case.
 */
export type Stage =
  | "Masuk"
  | "Diagnosa"
  | "Menunggu Konfirmasi"
  | "Menunggu Sparepart"
  | "Dikerjakan"
  | "Selesai"
  | "Sudah Diambil"
  | "Batal";

export const STAGES: { key: Stage; label: string; icon: LucideIcon }[] = [
  { key: "Masuk", label: "Masuk", icon: CircleDotIcon },
  { key: "Diagnosa", label: "Diagnosa", icon: SearchIcon },
  { key: "Menunggu Konfirmasi", label: "Konfirmasi", icon: ClockIcon },
  { key: "Menunggu Sparepart", label: "Sparepart", icon: PackageIcon },
  { key: "Dikerjakan", label: "Dikerjakan", icon: WrenchIcon },
  { key: "Selesai", label: "Selesai", icon: CheckIcon },
  { key: "Sudah Diambil", label: "Diambil", icon: TruckIcon },
  { key: "Batal", label: "Batal", icon: BanIcon },
];

export const DOT_COLOR: Record<Stage, string> = {
  Masuk: "bg-zinc-400",
  Diagnosa: "bg-amber-500",
  "Menunggu Konfirmasi": "bg-orange-500",
  "Menunggu Sparepart": "bg-yellow-500",
  Dikerjakan: "bg-blue-500",
  Selesai: "bg-emerald-500",
  "Sudah Diambil": "bg-violet-500",
  Batal: "bg-red-500",
};

export const stageIndex = (stage: Stage) => STAGES.findIndex((entry) => entry.key === stage);

export function StageTrack({ stage }: { stage: Stage }) {
  const idx = stageIndex(stage);
  return (
    <div className="flex items-center gap-1">
      {STAGES.map((entry, i) => {
        const Icon = entry.icon;
        const reached = i <= idx;
        const current = i === idx;
        return (
          <div key={entry.key} className="flex items-center gap-1">
            <div
              className={
                "flex size-5 items-center justify-center rounded-full border text-[10px] " +
                (current
                  ? "border-primary bg-primary text-primary-foreground"
                  : reached
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-border bg-muted text-muted-foreground/60")
              }
              aria-label={entry.label}
              title={entry.label}
            >
              <Icon className="size-3" />
            </div>
            {i < STAGES.length - 1 ? (
              <div className={"h-px w-2 " + (i < idx ? "bg-emerald-500/40" : "bg-border")} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
