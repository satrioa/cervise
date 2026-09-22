"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { XIcon } from "lucide-react";
import { searchTags } from "@/app/app/servis/actions";

type Props = {
  value: string[];
  onChange: (v: string[]) => void;
};

export function KerusakanTagInput({ value, onChange }: Props) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await searchTags(input);
        const filtered = res.filter((r) => !value.map((v) => v.toLowerCase()).includes(r.toLowerCase())).slice(0, 6);
        setSuggestions(filtered);
        setHighlight(0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [input, value]);

  const add = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (!t) return;
    if (value.map((v) => v.toLowerCase()).includes(t)) return;
    if (value.length >= 5) return;
    onChange([...value, t]);
    setInput("");
    setSuggestions([]);
    setHighlight(0);
  };

  const canSuggest = focused && suggestions.length > 0 && value.length < 5;
  const activeSuggestion = canSuggest ? suggestions[Math.min(highlight, suggestions.length - 1)] ?? null : null;
  const isPrefix = !!(activeSuggestion && input && activeSuggestion.toLowerCase().startsWith(input.toLowerCase()));
  const ghostRemainder = isPrefix ? activeSuggestion!.slice(input.length) : "";
  const showGhost = !!ghostRemainder && !!input;

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`flex flex-wrap gap-1.5 rounded-lg border bg-background px-2 py-2 shadow-xs/5 transition-colors ${focused ? "border-ring ring-[3px] ring-ring/24" : "border-input"}`}
        onClick={() => {
          const el = containerRef.current?.querySelector("input") as HTMLInputElement | null;
          el?.focus();
        }}
      >
        {value.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1 pr-1 shrink-0">
            {v}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="rounded p-0.5 hover:bg-foreground/10">
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
        <div className="relative flex-1 min-w-[120px]">
          {showGhost && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden whitespace-pre text-sm py-1"
            >
              <span className="invisible">{input}</span>
              <span className="text-muted-foreground/40">{ghostRemainder}</span>
              <span className="ml-2 hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                Tab
              </span>
            </span>
          )}
          <input
            ref={inputRef}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/72 py-1 relative"
            placeholder={value.length === 0 ? "Ketik kerusakan lalu Enter" : "Tambah tag..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && canSuggest) {
                e.preventDefault();
                setHighlight((h) => (h + 1) % suggestions.length);
                return;
              }
              if (e.key === "ArrowUp" && canSuggest) {
                e.preventDefault();
                setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
                return;
              }
              if (e.key === "Tab" && !e.shiftKey && activeSuggestion) {
                e.preventDefault();
                add(activeSuggestion);
                return;
              }
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                if (e.key === "," && input.trim()) {
                  add(input.trim());
                  return;
                }
                // Enter: if suggestions visible, pick highlighted (supports Arrow cycle), else custom tag
                if (canSuggest && activeSuggestion) {
                  add(activeSuggestion);
                } else if (input.trim()) {
                  add(input.trim());
                }
                return;
              }
              if (e.key === "Escape") {
                setSuggestions([]);
                return;
              }
              if (e.key === "Backspace" && !input && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
          />
        </div>
      </div>

      {focused && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1.5 w-full rounded-lg border bg-popover shadow-lg p-1 max-h-48 overflow-auto">
          {suggestions.map((s, idx) => {
            const isActive = idx === highlight;
            return (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(s);
                }}
                onMouseEnter={() => setHighlight(idx)}
                className={`w-full text-left rounded-md px-2.5 py-1.5 text-sm ${isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
