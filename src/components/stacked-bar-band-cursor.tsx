import { type ChartPoint, barY, colorLegend, crosshair, defineChart, stack } from "@tanstack/charts";
import { motion } from "@tanstack/charts/motion";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/react-charts/core";
import { useMemo } from "react";

import { scaleBand, scaleLinear } from "d3-scale";
import { Layers } from "lucide-react";

import type { DashboardBucket } from "@/lib/operational/dashboard";

interface StackedDatum {
  id: string;
  period: string;
  cause: string;
  deaths: number;
}

const motionRenderer = motion({
  initial: "always",
  transition: { type: "spring", stiffness: 170, damping: 18, mass: 1 },
});

const causes = ["Masuk", "Diambil", "Batal"] as const;
const causeKeys = ["masuk", "diambil", "batal"] as const;
const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

function buildData(buckets: DashboardBucket[]): StackedDatum[] {
  const results: StackedDatum[] = [];
  buckets.forEach((b) => {
    causeKeys.forEach((key, i) => {
      results.push({
        id: `${b.key}-${key}`,
        period: b.key,
        cause: causes[i],
        deaths: b[key] ?? 0,
      });
    });
  });
  return results;
}

function shadcnTooltipContent(points: readonly ChartPoint<StackedDatum>[]) {
  if (points.length === 0) return { title: "", rows: [] };
  const d = points[0].datum as StackedDatum;
  if (!d) return { title: "", rows: [] };
  const periodPoints = points.filter((p) => (p.datum as StackedDatum).period === d.period);
  return {
    title: d.period,
    rows: periodPoints.map((p) => {
      const datum = p.datum as StackedDatum;
      const idx = causes.indexOf(datum.cause as (typeof causes)[number]);
      return { label: datum.cause, value: `${datum.deaths}`, color: colors[idx] ?? "var(--chart-1)" };
    }),
  };
}

export function StackedBarBandCursor({ buckets }: { buckets: DashboardBucket[] }) {
  const data = useMemo(() => buildData(buckets), [buckets]);
  const periods = useMemo(() => buckets.map((b) => b.key), [buckets]);
  const max = useMemo(() => {
    const totals = buckets.map((b) => (b.masuk ?? 0) + (b.diambil ?? 0) + (b.batal ?? 0));
    return Math.max(...totals, 1);
  }, [buckets]);

  const definition = useMemo(
    () =>
      defineChart(
        {
          renderer: motionRenderer,
          marks: [
            crosshair<string, number>({
              id: "stacked-cursor-band",
              x: {
                band: {
                  fill: "var(--muted-foreground)",
                  fillOpacity: 0.15,
                  radius: 3,
                },
              },
              y: false,
            }),
            barY(data, {
              id: "stacked-cursor-bars",
              x: "period",
              y: "deaths",
              z: "cause",
              color: "cause",
              key: "id",
              layout: stack({ order: [...causes] }),
              radius: 2,
            }),
            crosshair<string, number>({
              id: "stacked-cursor-rule",
              x: false,
              y: {
                stroke: "var(--foreground)",
                strokeOpacity: 0.7,
                strokeWidth: 1,
                strokeDasharray: "4 4",
              },
            }),
          ],
          scales: {
            x: {
              scale: scaleBand<string>().domain(periods).padding(0.2),
            },
            y: {
              scale: scaleLinear().domain([0, max]),
              grid: true,
              axis: { label: "Total" },
            },
          },
          color: {
            domain: [...causes],
            range: colors,
            legend: colorLegend({ label: "Status" }),
          },
          focus: "group-x",
          maxFocusDistance: Number.POSITIVE_INFINITY,
          margin: { top: 24, right: 24, bottom: 32, left: 45 },
          theme: {
            foreground: "var(--muted-foreground)",
            grid: "var(--border)",
            background: "transparent",
          },
        },
        {
          keyboard: true,
          tooltip: {
            use: tooltip,
            className:
              "font-sans shadow-none rounded-md bg-popover text-popover-foreground border p-2 text-xs",
            anchor: "pointer",
            placement: "auto",
            content: (points) => shadcnTooltipContent(points),
          },
        },
      ),
    [data, periods, max],
  );

  if (buckets.length === 0) {
    return null;
  }

  return (
    <div className="h-[280px] w-full">
      <Chart
        definition={definition}
        renderer={motionRenderer}
        height={280}
        ariaLabel="Analitik servis stacked bar"
      />
    </div>
  );
}

export default StackedBarBandCursor;