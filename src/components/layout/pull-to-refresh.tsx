"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export const PULL_REFRESH_THRESHOLD = 72;

/** Murni, supaya bisa diuji tanpa DOM. */
export function shouldTriggerRefresh(distance: number, threshold = PULL_REFRESH_THRESHOLD) {
  return distance >= threshold;
}

type Options = {
  onRefresh: () => void | Promise<void>;
  threshold?: number;
  enabled?: boolean;
  /** Berubah saat elemen scroll di-mount ulang (mis. `key={pathname}`). */
  rebindKey?: string | number;
};

/**
 * Pull-to-refresh untuk kontainer scroll milik shell.
 *
 * touchmove dipasang manual dengan passive:false karena React memasang
 * touchmove sebagai passive — tanpa itu Safari tidak bisa dicegah perform
 * bounce-nya saat pengguna menarik dari posisi scrollTop = 0.
 */
export function usePullToRefresh(
  scrollRef: RefObject<HTMLElement | null>,
  { onRefresh, threshold = PULL_REFRESH_THRESHOLD, enabled = true, rebindKey }: Options,
) {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const currentDistance = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !enabled) return;
    if (typeof window === "undefined") return;
    // Hanya perangkat sentuh / layar kecil. Desktop tidak perlu gesture ini.
    const coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 1024;
    if (!coarse) return;

    const reset = () => {
      startY.current = null;
      currentDistance.current = 0;
      setDistance(0);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (refreshingRef.current || event.touches.length !== 1) return;
      if (element.scrollTop > 0) return;
      startY.current = event.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (startY.current === null || refreshingRef.current) return;
      const delta = (event.touches[0]?.clientY ?? 0) - startY.current;
      if (delta <= 0 || element.scrollTop > 0) {
        reset();
        return;
      }
      // Tahan supaya tarikan terasa berat dan tidak melewati batas wajar.
      currentDistance.current = Math.min(threshold * 1.5, delta * 0.5);
      setDistance(currentDistance.current);
      if (event.cancelable) event.preventDefault();
    };

    const onTouchEnd = async () => {
      if (startY.current === null) return;
      const shouldRefresh = shouldTriggerRefresh(currentDistance.current, threshold);
      reset();
      if (!shouldRefresh || refreshingRef.current) return;
      refreshingRef.current = true;
      setRefreshing(true);
      setDistance(threshold);
      try {
        await onRefreshRef.current();
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
        setDistance(0);
      }
    };

    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    element.addEventListener("touchend", onTouchEnd, { passive: true });
    element.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
      element.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [scrollRef, enabled, threshold, rebindKey]);

  return { distance, refreshing };
}

export function PullToRefreshIndicator({
  distance,
  refreshing,
  threshold = PULL_REFRESH_THRESHOLD,
}: {
  distance: number;
  refreshing: boolean;
  threshold?: number;
}) {
  const visible = refreshing || distance > 0;
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.25rem)] z-50 flex justify-center transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className="flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg"
        style={{ transform: `translateY(${Math.min(distance, threshold)}px)` }}
      >
        <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
        {refreshing
          ? "Menyegarkan…"
          : distance >= threshold
            ? "Lepaskan untuk menyegarkan"
            : "Tarik untuk menyegarkan"}
      </div>
    </div>
  );
}
