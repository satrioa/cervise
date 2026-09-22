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
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await searchTags(input);
        setSuggestions(res.filter((r) => !value.map((v) => v.toLowerCase()).includes(r.toLowerCase())).slice(0, 6));
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
  };

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
        <input
          className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/72 py-1"
          placeholder={value.length === 0 ? "Ketik kerusakan lalu Enter" : "Tambah tag..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              if (input.trim()) add(input.trim());
            }
            if (e.key === "Backspace" && !input && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
        />
      </div>

      {focused && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1.5 w-full rounded-lg border bg-popover shadow-lg p-1 max-h-48 overflow-auto">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                add(s);
              }}
              className="w-full text-left rounded-md px-2.5 py-1.5 text-sm hover:bg-accent"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
