"use client";

import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

interface ToggleGroupContextValue {
  value: string[];
  onValueChange: (value: string[]) => void;
}

const ToggleGroupContext = createContext<ToggleGroupContextValue>({
  value: [],
  onValueChange: () => {},
});

interface ToggleGroupProps extends React.ComponentProps<"div"> {
  value: string[];
  onValueChange: (value: string[]) => void;
}

export function ToggleGroup({ value, onValueChange, className, ...props }: ToggleGroupProps) {
  return (
    <ToggleGroupContext.Provider value={{ value, onValueChange }}>
      <div
        role="group"
        data-slot="toggle-group"
        className={cn("inline-flex items-center gap-px rounded-lg border bg-background p-[3px] shadow-xs/5", className)}
        {...props}
      />
    </ToggleGroupContext.Provider>
  );
}

interface ToggleGroupItemProps extends React.ComponentProps<"button"> {
  value: string;
  size?: "sm" | "default";
}

export function ToggleGroupItem({ value, size = "default", className, children, ...props }: ToggleGroupItemProps) {
  const { value: groupValue, onValueChange } = useContext(ToggleGroupContext);
  const pressed = groupValue.includes(value);
  return (
    <button
      type="button"
      data-slot="toggle-group-item"
      aria-pressed={pressed}
      data-pressed={pressed ? "" : undefined}
      onClick={() => onValueChange([value])}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-64 data-pressed:bg-muted data-pressed:text-foreground data-pressed:shadow-xs [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        size === "sm" ? "h-7 min-w-7 px-1.5 text-sm" : "h-8 min-w-8 px-2 text-sm",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
