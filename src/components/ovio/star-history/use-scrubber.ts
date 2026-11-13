"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatDate, formatNumber } from "@/lib/format";
import { keyToIndex } from "@/lib/keys";
import { formatMonth, formatStars, nearestIndex, type StarHistoryShape } from "./shape";

/**
 * Explores the chart one item at a time, by pointer or keyboard. The plot is a single slider-like
 * tab stop: hover or drag picks the nearest item, arrows step one item, Page Up/Down and Shift+arrow
 * jump a twelfth of the range, Home/End go to the ends. Focus starts on the latest item.
 */
function useScrubber(xs: number[], label: string, valueText: (index: number) => string) {
  const [active, setActive] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const count = xs.length;
  const last = Math.max(0, count - 1);
  const index = active === null || !count ? null : Math.min(active, last);
  const page = Math.max(1, Math.round(count / 12));

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    if (!count) return;
    const r = e.currentTarget.getBoundingClientRect();
    setActive(nearestIndex(xs, (e.clientX - r.left) / (r.width || 1)));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = keyToIndex(e.key, index ?? last, count, {
      vertical: true,
      step: e.shiftKey ? page : 1,
      page,
    });
    if (next === null) return;
    e.preventDefault();
    setActive(next);
  };

  const now = index ?? last;
  return {
    index,
    props: {
      role: "slider",
      tabIndex: count ? 0 : -1,
      "aria-label": label,
      "aria-valuemin": 0,
      "aria-valuemax": last,
      "aria-valuenow": now,
      "aria-valuetext": count ? valueText(now) : "No data",
      onPointerMove: pick,
      onPointerDown: pick,
      onPointerLeave: () => !focused && setActive(null),
      onFocus: () => {
        setFocused(true);
        setActive((a) => a ?? last);
      },
      onBlur: () => {
        setFocused(false);
        setActive(null);
      },
      onKeyDown,
    },
  } as const;
}

export type Scrubber = ReturnType<typeof useScrubber>;

/** Scrubs day by day, for the line charts. */
export function usePointScrubber(shape: StarHistoryShape, label: string): Scrubber {
  return useScrubber(
    shape.points.map((p) => p.x),
    label,
    (i) => `${formatDate(shape.points[i].time)}: ${formatStars(shape.points[i].stars)}`,
  );
}

/** Scrubs month by month, for the bar charts. Bars are evenly spaced, so positions are centres. */
export function useMonthScrubber(shape: StarHistoryShape, label: string): Scrubber {
  const n = shape.months.length;
  return useScrubber(
    shape.months.map((_, i) => (i + 0.5) / n),
    label,
    (i) => {
      const m = shape.months[i];
      return `${formatMonth(m)}: ${formatStars(m.stars)}, ${formatNumber(m.gain)} new`;
    },
  );
}
