"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring, type SpringOptions } from "motion/react";
import { cn } from "@/lib/utils";

const DEFAULT_SPRING: SpringOptions = {
  stiffness: 150,
  damping: 15,
  mass: 0.1,
};

export function Magnetic({
  children,
  className,
  strength = 0.35,
  transition = DEFAULT_SPRING,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
  transition?: SpringOptions;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, transition);
  const springY = useSpring(y, transition);

  return (
    <motion.div
      ref={ref}
      style={{ x: springX, y: springY }}
      onPointerMove={(event) => {
        const node = ref.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        x.set((event.clientX - (rect.left + rect.width / 2)) * strength);
        y.set((event.clientY - (rect.top + rect.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className={cn("inline-flex", className)}
    >
      {children}
    </motion.div>
  );
}

export default Magnetic;
