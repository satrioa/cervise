"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCenter,
} from "@dnd-kit/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

/* ── Types ── */

type ColumnId = "intake" | "diagnosa" | "repair" | "qc" | "ready";

interface CardData {
  id: string;
  device: string;
  ticket: string;
}

const COLUMNS: { id: ColumnId; label: string; dot: string }[] = [
  { id: "intake", label: "Intake", dot: "bg-sky-400" },
  { id: "diagnosa", label: "Diagnosa", dot: "bg-amber-400" },
  { id: "repair", label: "Perbaikan", dot: "bg-orange-400" },
  { id: "qc", label: "QC", dot: "bg-emerald-400" },
  { id: "ready", label: "Siap", dot: "bg-violet-400" },
];

const INITIAL_CARDS: CardData[] = [
  { id: "sv-2103", device: "iPhone 15 Pro", ticket: "#SV-2103" },
  { id: "sv-2104", device: "iPhone 13", ticket: "#SV-2104" },
  { id: "sv-2105", device: "MacBook Air M2", ticket: "#SV-2105" },
  { id: "sv-2106", device: "Samsung S24", ticket: "#SV-2106" },
  { id: "sv-2107", device: "iPad Pro", ticket: "#SV-2107" },
];

const STAGE_ORDER: ColumnId[] = ["intake", "diagnosa", "repair", "qc", "ready"];

/* ── Helpers ── */

function deterministicInitialCards(): Record<ColumnId, CardData[]> {
  return {
    intake: [INITIAL_CARDS[0], INITIAL_CARDS[1]],
    diagnosa: [INITIAL_CARDS[2]],
    repair: [INITIAL_CARDS[3], INITIAL_CARDS[4]],
    qc: [],
    ready: [],
  };
}

let nextId = 2110;
function spawnCard(): CardData {
  const devices = ["Pixel 8", "AirPods Pro", "MacBook Pro", "iPad Air", "Galaxy Watch"];
  const device = devices[Math.floor(Math.random() * devices.length)];
  const id = `sv-${nextId++}`;
  return { id, device, ticket: `#${id.toUpperCase()}` };
}

/* ── DnD Card ── */

function KanbanCard({
  card,
  isDragOverlay,
}: {
  card: CardData;
  isDragOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: card.id, data: card });

  const style: React.CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <motion.div
      layoutId={card.id}
      ref={!isDragOverlay ? setNodeRef : undefined}
      style={isDragOverlay ? undefined : style}
      {...(!isDragOverlay ? attributes : {})}
      {...(!isDragOverlay ? listeners : {})}
      role="button"
      aria-label={`${card.device} — ${card.ticket}`}
      aria-roledescription="draggable"
      tabIndex={0}
      className={cn(
        "group/card cursor-grab touch-none select-none rounded-xl border px-3 py-2.5 text-xs leading-tight transition-colors",
        "border-white/[0.06] bg-white/[0.04] backdrop-blur-sm",
        "hover:border-white/15 hover:bg-white/[0.07]",
        "focus-visible:outline-2 focus-visible:outline-primary/60",
        isDragging && "opacity-30",
        isDragOverlay &&
          "scale-[1.03] rotate-[2deg] border-primary/30 bg-white/10 shadow-xl shadow-black/40",
      )}
    >
      <div className="truncate font-medium text-foreground text-[11px]">
        {card.device}
      </div>
      <div className="mt-1 text-muted-foreground text-[10px]">{card.ticket}</div>
    </motion.div>
  );
}

/* ── DnD Column ── */

function KanbanColumn({
  column,
  cards,
  draggedId,
}: {
  column: (typeof COLUMNS)[number];
  cards: CardData[];
  draggedId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[130px] shrink-0 flex-col gap-3 rounded-xl border p-3 transition-all duration-200",
        "border-white/[0.06] bg-white/[0.02]",
        isOver && "border-primary/40 bg-primary/5 shadow-[0_0_20px_-8px_oklch(76.2%_0.154_159.36/0.3)]",
      )}
    >
      <div className="flex items-center justify-between gap-1 px-0.5">
        <span className="flex items-center gap-1.5 truncate text-xs font-medium text-muted-foreground">
          <span className={cn("inline-block size-1.5 shrink-0 rounded-full", column.dot)} />
          {column.label}
        </span>
        <span className="shrink-0 rounded-md bg-white/5 px-1.5 text-[10px] tabular-nums text-muted-foreground">
          {cards.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 min-h-[100px]">
        <AnimatePresence>
          {cards.map((card) => (
            <KanbanCard key={card.id} card={card} />
          ))}
        </AnimatePresence>
          {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/5 py-6">
            <span className="text-[11px] text-muted-foreground/40">—</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Preview ── */

export function KanbanPreview() {
  const [mounted, setMounted] = useState(false);
  const [columns, setColumns] = useState<Record<ColumnId, CardData[]>>(deterministicInitialCards);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 6 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 8 },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  const activeCard =
    activeId && !isDragging
      ? null
      : Object.values(columns)
          .flat()
          .find((c) => c.id === activeId);

  /* ── Auto-demo ── */

  const advanceAutoDemo = useCallback(() => {
    if (isDraggingRef.current) return;
    setColumns((prev) => {
      const cols = { ...prev };
      const allCards = Object.entries(cols).flatMap(([colId, cards]) =>
        cards.map((c) => ({ ...c, col: colId as ColumnId })),
      );
      if (allCards.length === 0) return prev;

      // Pick a random card
      const pick = allCards[Math.floor(Math.random() * allCards.length)];
      const fromIdx = STAGE_ORDER.indexOf(pick.col);
      const toIdx = fromIdx + 1;

      if (toIdx >= STAGE_ORDER.length) {
        // Remove card (goes to customer)
        cols[pick.col] = cols[pick.col].filter((c) => c.id !== pick.id);
        // Spawn new card in intake
        cols.intake = [spawnCard(), ...cols.intake];
      } else {
        const nextCol = STAGE_ORDER[toIdx];
        cols[pick.col] = cols[pick.col].filter((c) => c.id !== pick.id);
        cols[nextCol] = [...cols[nextCol], pick];
      }
      return cols;
    });
  }, []);

  const scheduleNextDemo = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const delay = 6000 + Math.random() * 2000;
    idleTimer.current = setTimeout(() => {
      advanceAutoDemo();
      scheduleNextDemo();
    }, delay);
  }, [advanceAutoDemo]);

  useEffect(() => {
    scheduleNextDemo();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [scheduleNextDemo]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="-mx-6 -mb-6 mt-3 overflow-x-auto overscroll-x-contain hide-scrollbar" style={{ maskImage: "linear-gradient(to bottom, black 70%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 70%, transparent 100%)" }}>
        <div className="flex gap-3 px-6 pb-4" style={{ width: "max-content", minWidth: "100%" }}>
          {COLUMNS.map((col) => (
            <KanbanColumn key={col.id} column={col} cards={columns[col.id]} draggedId={null} />
          ))}
        </div>
      </div>
    );
  }

  /* ── DnD handlers ── */

  const findColumn = (id: string): ColumnId | null => {
    for (const [colId, cards] of Object.entries(columns)) {
      if (cards.some((c) => c.id === id)) return colId as ColumnId;
    }
    return null;
  };

  const onDragStart = (event: DragStartEvent) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    setActiveId(event.active.id as string);
    if (idleTimer.current) clearTimeout(idleTimer.current);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setIsDragging(false);
    setActiveId(null);
    isDraggingRef.current = false;

    if (!over) {
      scheduleNextDemo();
      return;
    }

    const activeCol = findColumn(active.id as string);
    const overId = over.id as string;
    // over could be a column or a card
    const overCol = findColumn(overId) ?? (overId as ColumnId);
    if (!activeCol || !overCol) {
      scheduleNextDemo();
      return;
    }

    if (activeCol === overCol) return;

    setColumns((prev) => {
      const cols = { ...prev };
      const card = cols[activeCol].find((c) => c.id === active.id);
      if (!card) return prev;
      cols[activeCol] = cols[activeCol].filter((c) => c.id !== active.id);
      cols[overCol] = [...cols[overCol], card];
      return cols;
    });

    scheduleNextDemo();
  };

  const onDragCancel = () => {
    setIsDragging(false);
    setActiveId(null);
    isDraggingRef.current = false;
    setTimeout(scheduleNextDemo, 5000);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="-mx-6 -mb-6 mt-3 overflow-x-auto overscroll-x-contain hide-scrollbar" style={{ maskImage: "linear-gradient(to bottom, black 70%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 70%, transparent 100%)" }}>
        <div className="flex gap-3 px-6 pb-4" style={{ width: "max-content", minWidth: "100%" }}>
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              cards={columns[col.id]}
              draggedId={activeId}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeCard && isDragging ? (
          <KanbanCard card={activeCard} isDragOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
