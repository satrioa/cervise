"use client";

import { useRef, useState, useCallback } from "react";

type Props = {
  value: string; // "0,1,4,7"
  onChange: (v: string) => void;
};

const DOTS = Array.from({ length: 9 }, (_, i) => i);

function idxToPos(idx: number) {
  const r = Math.floor(idx / 3);
  const c = idx % 3;
  return { r, c };
}

export function PatternLock({ value, onChange }: Props) {
  const path = value ? value.split(",").map((n) => Number(n)).filter((n) => !isNaN(n)) : [];
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [tempPath, setTempPath] = useState<number[]>([]);

  const activePath = dragging ? tempPath : path;

  // hit test berbasis jarak ke center dot, biar bisa lompat 0->2 / 0->6 tanpa harus lewat dot tengah
  const getIdxFromPoint = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    // dot centers in pixel: col* (w/3) + w/6, same for h
    const cellW = rect.width / 3;
    const cellH = rect.height / 3;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: number | null = null;
    let bestDist = Infinity;
    for (let idx = 0; idx < 9; idx++) {
      const { r, c } = idxToPos(idx);
      const cx = c * cellW + cellW / 2;
      const cy = r * cellH + cellH / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // radius threshold: ~40% cell size (biar bisa skip tengah kalau arc)
      const threshold = Math.min(cellW, cellH) * 0.42;
      if (dist <= threshold && dist < bestDist) {
        bestDist = dist;
        best = idx;
      }
    }
    return best;
  }, []);

  const start = useCallback(
    (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture(e.pointerId);
      const idx = getIdxFromPoint(e.clientX, e.clientY);
      if (idx !== null) {
        setDragging(true);
        setTempPath([idx]);
      }
    },
    [getIdxFromPoint]
  );

  const move = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const idx = getIdxFromPoint(e.clientX, e.clientY);
      if (idx !== null && !tempPath.includes(idx)) {
        setTempPath((prev) => [...prev, idx]);
      }
    },
    [dragging, getIdxFromPoint, tempPath]
  );

  const end = useCallback(() => {
    if (dragging) {
      if (tempPath.length >= 4) {
        onChange(tempPath.join(","));
      } else if (tempPath.length > 0 && tempPath.length < 4) {
        // require min 4
        // keep as is but mark invalid via parent validation
        onChange(tempPath.join(","));
      }
      setDragging(false);
    }
  }, [dragging, tempPath, onChange]);

  const clear = () => onChange("");

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="relative mx-auto grid h-[200px] w-[200px] grid-cols-3 grid-rows-3 gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 touch-none select-none"
      >
        {/* svg lines */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full p-3">
          {activePath.map((idx, i) => {
            if (i === 0) return null;
            const prev = activePath[i - 1];
            const a = idxToPos(prev);
            const b = idxToPos(idx);
            // center per cell
            const cellW = 100 / 3;
            const cellH = 100 / 3;
            const x1 = a.c * cellW + cellW / 2;
            const y1 = a.r * cellH + cellH / 2;
            const x2 = b.c * cellW + cellW / 2;
            const y2 = b.r * cellH + cellH / 2;
            return <line key={i} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke="currentColor" strokeWidth={2} className="text-primary" strokeLinecap="round" />;
          })}
        </svg>
        {DOTS.map((idx) => {
          const active = activePath.includes(idx);
          const order = activePath.indexOf(idx);
          return (
            <div key={idx} className="flex items-center justify-center">
              <div
                className={`flex size-10 items-center justify-center rounded-full border-2 text-xs font-mono transition-colors ${
                  active ? "bg-primary border-primary text-primary-foreground" : "bg-background border-border"
                }`}
              >
                {active ? order + 1 : <span className="size-2 rounded-full bg-muted-foreground/30" />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-muted-foreground">
          {activePath.length >= 4 ? `${activePath.length} titik` : activePath.length ? "Minimal 4 titik" : "Gambar pola (drag)"}
        </span>
        {value && (
          <button type="button" onClick={clear} className="text-xs underline underline-offset-2 hover:text-foreground">
            Hapus
          </button>
        )}
      </div>
      {value && <div className="font-mono text-[10px] text-muted-foreground">Value: {value}</div>}
    </div>
  );
}
