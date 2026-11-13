"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import type { DashboardBucket } from "@/lib/operational/dashboard";

const chartConfig = {
  masuk: {
    label: "Masuk",
    color: "var(--chart-1)",
  },
  diambil: {
    label: "Diambil",
    color: "var(--chart-2)",
  },
  batal: {
    label: "Batal",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export function StackedBarBandCursor({ buckets }: { buckets: DashboardBucket[] }) {
  const chartData = buckets.map((b) => ({
    day: b.key,
    masuk: b.masuk ?? 0,
    diambil: b.diambil ?? 0,
    batal: b.batal ?? 0,
  }));

  if (buckets.length === 0) {
    return null;
  }

  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <BarChart accessibilityLayer data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => String(value).slice(0, 6)}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="masuk"
          stackId="a"
          fill="var(--color-masuk)"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="diambil"
          stackId="a"
          fill="var(--color-diambil)"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="batal"
          stackId="a"
          fill="var(--color-batal)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}

export default StackedBarBandCursor;