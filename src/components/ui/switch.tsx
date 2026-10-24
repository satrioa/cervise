"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sound";

export function Switch({ className, onCheckedChange, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-primary",
        className
      )}
      // clasp = menyalakan (ON), unclasp = mematikan (OFF).
      // Suara mengikuti NILAI BARU, bukan posisi sebelumnya.
      onCheckedChange={(checked, eventDetails) => {
        if (checked) sfx.toggleOn();
        else sfx.toggleOff();
        onCheckedChange?.(checked, eventDetails);
      }}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-checked:translate-x-4 data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}
