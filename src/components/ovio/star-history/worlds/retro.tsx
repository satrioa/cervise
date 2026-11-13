import { motion } from "motion/react";
import { motionTokens } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { formatMonthDot } from "../shape";
import type { StarHistoryWorldProps } from "../star-history";
import { useMonthScrubber } from "../use-scrubber";

const STRIPES = "repeating-linear-gradient(0deg,#4fdc68 0 6px,transparent 6px 8px)";

export default function RetroStarHistory({
  shape,
  label,
  animation,
  dataKey,
  className,
}: StarHistoryWorldProps) {
  const scrub = useMonthScrubber(shape, label);
  const active = scrub.index === null ? null : shape.months[scrub.index];
  const { months } = shape;
  const first = months[0];
  const last = months.at(-1);

  // Bars switch on left to right, one hard frame each, like a slow plotter.
  const on = (i: number) =>
    animation === "none"
      ? {}
      : {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { ...motionTokens.retro.frames(1, 0.01), delay: i * 0.06 },
        };

  return (
    <figure
      data-ovio-world="retro"
      className={cn(
        "relative m-0 flex w-full max-w-170 flex-col gap-3.5 bg-(--ovio-stage) px-8 py-7 font-(family-name:--ovio-font) text-(--ovio-ink) text-shadow-(--ovio-glow)",
        className,
      )}
    >
      <div className="flex justify-between gap-4 text-[22px]">
        <span>STAR_HISTORY.DAT</span>
        <span>
          <span className="tabular-nums">{formatNumber(active?.stars ?? shape.total)}</span> ★
        </span>
      </div>
      <div className="relative flex h-60 items-end gap-1 border-b-[3px] border-l-[3px] border-(--ovio-line) pl-1">
        {months.map((m, i) => (
          <motion.div
            key={`${dataKey}-${m.year}-${m.month}`}
            aria-hidden
            className="relative flex-1"
            style={{
              height: `${(m.h * 100).toFixed(1)}%`,
              background: i === scrub.index ? "var(--ovio-ink)" : STRIPES,
              boxShadow: "0 0 6px rgba(80,255,120,.35)",
            }}
            {...on(i)}
          >
            {animation === "always" && i === months.length - 1 && (
              <motion.span
                className="absolute inset-x-0 -top-3 h-2 bg-(--ovio-ink)"
                animate={{ opacity: [1, 0] }}
                transition={motionTokens.retro.blink}
              />
            )}
          </motion.div>
        ))}
        <div {...scrub.props} className="absolute inset-0 cursor-crosshair touch-pan-y" />
      </div>
      <div aria-hidden className="flex justify-between gap-3 text-lg text-(--ovio-ink-2)">
        <span>{first && formatMonthDot(first)}</span>
        <span className="min-w-0 text-right">
          {active
            ? `${formatMonthDot(active)} :: +${formatNumber(active.gain)}`
            : shape.annotations
                .map((a) => `>> ${a.label.toUpperCase()} @ ${formatMonthDot(months[a.month])}`)
                .join("  ")}
        </span>
        <span>{last && formatMonthDot(last)}</span>
      </div>
      <figcaption className="sr-only">{shape.summary}</figcaption>
      <div aria-hidden className="ovio-scanlines" />
    </figure>
  );
}
