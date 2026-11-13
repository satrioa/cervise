import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} width={36} />
          <Tooltip />
          <Legend />
          {SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} stackId="stack" fill={s.color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default StackedBarBandCursor;