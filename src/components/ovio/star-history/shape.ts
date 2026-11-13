import { formatCount, formatDate, formatMonth as monthLabel, formatNumber } from "@/lib/format";
import type { StarHistoryAnnotation, StarHistoryPoint } from "./star-history";

/**
 * Data shaping for the star chart, shared by every world. Positions are fractions (0–1) so each
 * world can map them onto its own plot size. Dates are read and printed in UTC so the server
 * and the browser agree.
 */

export type ShapedPoint = StarHistoryPoint & {
  time: number;
  /** Across the time range, 0 at the first day and 1 at the last. */
  x: number;
  /** Stars as a share of the peak, 0 at the baseline. */
  y: number;
};

type ShapedMonth = {
  year: number;
  /** 1–12. */
  month: number;
  /** Cumulative stars at the end of the month (or the last day we have). */
  stars: number;
  /** Stars gained during the month. */
  gain: number;
  /** stars as a share of the peak. */
  h: number;
  /** Labels of annotations that fall in this month. */
  notes: string[];
};

type ShapedAnnotation = StarHistoryAnnotation & {
  /** Nearest data point. */
  point: ShapedPoint;
  index: number;
  /** Index into months. */
  month: number;
};

export type StarHistoryShape = {
  points: ShapedPoint[];
  months: ShapedMonth[];
  annotations: ShapedAnnotation[];
  total: number;
  /** A one-paragraph text equivalent of the chart. */
  summary: string;
};

/** "Jul 2025". */
export const formatMonth = (m: Pick<ShapedMonth, "year" | "month">) => monthLabel(m.year, m.month);
/** "2025.07". */
export const formatMonthDot = (m: Pick<ShapedMonth, "year" | "month">) =>
  `${m.year}.${String(m.month).padStart(2, "0")}`;
/** "1 star", "2,400 stars". */
export const formatStars = (n: number) => formatCount(n, "star");

const toTime = (date: string) => {
  const t = Date.parse(date);
  return Number.isNaN(t) ? 0 : t;
};

/** Index of the item whose position is nearest to `x`, by binary search over sorted positions. */
export function nearestIndex(xs: number[], x: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid;
    else hi = mid;
  }
  return Math.abs(xs[hi] - x) < Math.abs(xs[lo] - x) ? hi : lo;
}

export function shapeStarHistory(
  data: StarHistoryPoint[],
  annotations: StarHistoryAnnotation[],
  repo?: string,
): StarHistoryShape {
  const sorted = data.map((d) => ({ ...d, time: toTime(d.date) })).sort((a, b) => a.time - b.time);
  const total = sorted.at(-1)?.stars ?? 0;
  const peak = Math.max(1, ...sorted.map((d) => d.stars));
  const t0 = sorted[0]?.time ?? 0;
  const span = (sorted.at(-1)?.time ?? 0) - t0 || 1;

  const points: ShapedPoint[] = sorted.map((d) => ({
    ...d,
    x: sorted.length > 1 ? (d.time - t0) / span : 0.5,
    y: d.stars / peak,
  }));

  // Month buckets, from the first month to the last with no gaps; empty months carry forward.
  const months: ShapedMonth[] = [];
  if (points.length) {
    const first = new Date(points[0].time);
    const last = new Date(points.at(-1)!.time);
    let y = first.getUTCFullYear();
    let m = first.getUTCMonth() + 1;
    let i = 0;
    let stars = 0;
    while (
      y < last.getUTCFullYear() ||
      (y === last.getUTCFullYear() && m <= last.getUTCMonth() + 1)
    ) {
      const end = Date.UTC(y, m, 1);
      while (i < points.length && points[i].time < end) stars = points[i++].stars;
      const prev = months.at(-1)?.stars ?? 0;
      months.push({ year: y, month: m, stars, gain: stars - prev, h: stars / peak, notes: [] });
      m = m === 12 ? 1 : m + 1;
      if (m === 1) y++;
    }
  }

  const xs = points.map((p) => p.x);
  const shapedNotes: ShapedAnnotation[] = points.length
    ? annotations.map((a) => {
        const index = nearestIndex(xs, (toTime(a.date) - t0) / span);
        const point = points[index];
        const d = new Date(point.time);
        const month = months.findIndex(
          (mo) => mo.year === d.getUTCFullYear() && mo.month === d.getUTCMonth() + 1,
        );
        months[month]?.notes.push(a.label);
        return { ...a, point, index, month };
      })
    : [];

  const name = repo ?? "This repository";
  const summary = points.length
    ? `${name} went from ${formatStars(points[0].stars)} on ${formatDate(points[0].time)} to ${formatNumber(total)} on ${formatDate(points.at(-1)!.time)}.` +
      shapedNotes
        .map((a) => ` ${formatDate(a.point.time)}: ${a.label} (${formatStars(a.point.stars)}).`)
        .join("")
    : `${name} has no star history yet.`;

  return { points, months, annotations: shapedNotes, total, summary };
}

/** The first, middle and last months, for the axis. */
export function monthTicks(shape: StarHistoryShape): ShapedMonth[] {
  const m = shape.months;
  if (!m.length) return [];
  return [...new Set([0, Math.floor((m.length - 1) / 2), m.length - 1])].map((i) => m[i]);
}

type XY = [number, number];

export function linePath(pts: XY[]): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
}

/** A Catmull-Rom curve through every point, written as cubic Béziers. */
export function smoothPath(pts: XY[]): string {
  if (pts.length < 2) return linePath(pts);
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}
