import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";

import type { DashboardBucket } from "@/lib/operational/dashboard";

const SERIES = [
  { key: "masuk" as const, name: "Masuk", color: "var(--chart-1)" },
  { key: "diambil" as const, name: "Diambil", color: "var(--chart-2)" },
  { key: "batal" as const, name: "Batal", color: "var(--chart-3)" },
] as const;

export function StackedBarBandCursor({ buckets }: { buckets: DashboardBucket[] }) {
  const data = buckets.map((b) => ({
    day: b.key,
    masuk: b.masuk ?? 0,
    diambil: b.diambil ?? 0,
    batal: b.batal ?? 0,
  }));

  if (buckets.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <BarChart
        data={data}
        xDataKey="day"
        stacked
        aspectRatio="16 / 9"
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        {SERIES.map((s) => (
          <Bar key={s.key} dataKey={s.key} fill={s.color} lineCap="round" />
        ))}
      </BarChart>
    </div>
  );
}

export default StackedBarBandCursor;