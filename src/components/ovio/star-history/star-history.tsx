"use client";

import { type ComponentType, useMemo } from "react";
import { useWorld } from "@/components/shared/world-provider";
import { everyWorld, type InstalledWorld } from "@/lib/world";
import { useReducedMotionSafe, type OvioAnimation } from "@/lib/motion";
import { shapeStarHistory, type StarHistoryShape } from "./shape";
import type { StarHistoryPoint, StarHistoryAnnotation } from "./types";
import * as worlds from "./worlds";

export type { StarHistoryPoint, StarHistoryAnnotation } from "./types";

export type StarHistoryAnimation = OvioAnimation;

export type StarHistoryProps = {
  /** Cumulative stars by day. Any order; sorted by date. */
  data: StarHistoryPoint[];
  /** "owner/name". Used for the title and the chart's accessible name only. */
  repo?: string;
  annotations?: StarHistoryAnnotation[];
  variant?: InstalledWorld<typeof worlds>;
  /** "always" adds a live marker on the latest point. Forced to "none" under reduced motion. */
  animation?: StarHistoryAnimation;
  className?: string;
};

/** Everything a world needs to draw the chart. Worlds only render; data shaping lives here. */
export type StarHistoryWorldProps = {
  shape: StarHistoryShape;
  /** The repo's name without its owner ("lumen"), for titles. */
  name: string;
  /** Accessible name for the chart's scrubber. */
  label: string;
  animation: StarHistoryAnimation;
  /** Changes when the data changes, to replay the entrance. */
  dataKey: string;
  className?: string;
};

const NO_ANNOTATIONS: StarHistoryAnnotation[] = [];

/** The installed worlds; a single-world install draws its one world for any provider world. */
const VIEWS = everyWorld<ComponentType<StarHistoryWorldProps>>(worlds);

export function StarHistory({
  data,
  repo,
  annotations = NO_ANNOTATIONS,
  variant,
  animation = "enter-exit",
  className,
}: StarHistoryProps) {
  const world = useWorld(variant);
  const reduced = useReducedMotionSafe();
  const motionMode = reduced ? "none" : animation;
  const shape = useMemo(() => shapeStarHistory(data, annotations, repo), [data, annotations, repo]);

  const last = shape.points.at(-1);
  const props: StarHistoryWorldProps = {
    shape,
    name: repo?.split("/").pop() || "repository",
    label: repo ? `Star history of ${repo}` : "Star history",
    animation: motionMode,
    dataKey: `${shape.points.length}:${shape.points[0]?.date ?? ""}:${last?.date ?? ""}:${shape.total}`,
    className,
  };

  const View = VIEWS[world] ?? VIEWS.minimal;
  return <View {...props} />;
}
