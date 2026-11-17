"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

export interface MaskRevealUpProps {
  /** Text content. Use "\n" to separate lines, or pass `lines` instead. */
  children?: string;
  className?: string;
  /** Delay before the animation starts, in milliseconds. */
  delay?: number;
  /** Explicit line array. Takes precedence over children. */
  lines?: string[];
  /** Per-line (or per-word with `perWord`) stagger, in milliseconds. */
  stagger?: number;
  /** Animate only once the text scrolls into view. */
  triggerOnView?: boolean;
  /** Reveal word by word instead of line by line. */
  perWord?: boolean;
}

const DURATION_S = 0.76;
const MS = 1000;
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * MaskRevealUp — per-line masked reveal with upward motion and soft blur,
 * inspired by Apple section transitions. Each line rises from beneath an
 * overflow-hidden mask. From the animate-text catalog (`mask-reveal-up`).
 * With `perWord`, each word gets its own mask and stagger instead.
 */
export default function MaskRevealUp({
  children,
  lines: linesProp,
  className = "",
  delay = 0,
  stagger = 90,
  triggerOnView = false,
  perWord = false,
}: MaskRevealUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const shouldReduceMotion = useReducedMotion();
  const play = (!triggerOnView || inView) && !shouldReduceMotion;

  const lines = linesProp ?? (children ? children.split("\n") : []);
  const label = lines.join(" ");

  let wordOffset = 0;

  return (
    <span
      aria-label={label}
      className={className}
      ref={ref}
      style={{ display: "block" }}
    >
      {lines.map((line, lineIndex) => {
        const words = perWord ? line.split(" ") : [];
        return (
          <span
            key={lineIndex}
            style={{ display: "block", overflow: perWord ? "visible" : "hidden" }}
          >
            {perWord
              ? words.map((word, wordIndex) => {
                  const index = wordOffset++;
                  return (
                    <span
                      key={wordIndex}
                      style={{
                        display: "inline-block",
                        overflow: "hidden",
                        verticalAlign: "bottom",
                      }}
                    >
                      <motion.span
                        animate={
                          play
                            ? { filter: "blur(0px)", opacity: 1, y: 0 }
                            : undefined
                        }
                        aria-hidden="true"
                        initial={
                          shouldReduceMotion
                            ? { opacity: 1 }
                            : { filter: "blur(6px)", opacity: 0, y: 30 }
                        }
                        style={{ display: "block" }}
                        transition={
                          shouldReduceMotion
                            ? { duration: 0 }
                            : {
                                delay: delay / MS + (index * stagger) / MS,
                                duration: DURATION_S,
                                ease: EASE,
                              }
                        }
                      >
                        {word}
                        {wordIndex < words.length - 1 ? "\u00A0" : ""}
                      </motion.span>
                    </span>
                  );
                })
              : (
                  <motion.span
                    animate={
                      play
                        ? { filter: "blur(0px)", opacity: 1, y: 0 }
                        : undefined
                    }
                    aria-hidden="true"
                    initial={
                      shouldReduceMotion
                        ? { opacity: 1 }
                        : { filter: "blur(6px)", opacity: 0, y: 30 }
                    }
                    style={{ display: "block" }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : {
                            delay: delay / MS + (lineIndex * stagger) / MS,
                            duration: DURATION_S,
                            ease: EASE,
                          }
                    }
                  >
                    {line}
                  </motion.span>
                )}
          </span>
        );
      })}
    </span>
  );
}
