"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { ChartContainer as UIChartContainer, ChartTooltipContent } from "@/components/ui/chart";

// Re-export UI chart container with default config for devl compatibility
export function ChartContainer({
  className,
  children,
  config = {},
  ...props
}: Omit<React.ComponentProps<typeof UIChartContainer>, "config"> & { config?: any }) {
  return (
    <UIChartContainer config={config} className={className} {...(props as any)}>
      {children}
    </UIChartContainer>
  );
}

export function ChartGrid(props: React.ComponentProps<typeof RechartsPrimitive.CartesianGrid>) {
  return <RechartsPrimitive.CartesianGrid strokeDasharray="3 3" className="stroke-border/50" {...props} />;
}

export function ChartAxis(
  props: React.ComponentProps<typeof RechartsPrimitive.XAxis> & { axis?: "x" | "y" }
) {
  const { axis = "x", ...rest } = props as any;
  if (axis === "y") {
    return <RechartsPrimitive.YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} {...rest} />;
  }
  return <RechartsPrimitive.XAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} {...rest} />;
}

export function ChartTooltip(props: React.ComponentProps<typeof RechartsPrimitive.Tooltip>) {
  return <RechartsPrimitive.Tooltip content={<ChartTooltipContent />} {...props} />;
}

export function chartColor(index: number): string {
  const chartIndex = ((index % 5) + 1) as 1 | 2 | 3 | 4 | 5;
  // Use CSS variables defined in globals.css --chart-1 etc (oklch)
  return `var(--chart-${chartIndex})`;
}
