"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";

export type PTabs10Item = {
  value: string;
  label: string;
  count: number;
  /** Tanpa panel: tabs dipakai murni sebagai filter untuk daftar di luar komponen. */
  content?: ReactNode;
};

/**
 * Pola `@coss/p-tabs-10`: tab dengan badge jumlah. Dipakai opname untuk
 * memilih domain; lebar tab menyesuaikan ruang yang tersedia.
 */
export function PTabs10({
  value,
  onValueChange,
  items,
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: PTabs10Item[];
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <TabsList className="w-full">
        {items.map((item) => (
          <TabsTab key={item.value} value={item.value} className="min-w-0 flex-1">
            <span className="truncate">{item.label}</span>
            <Badge
              variant="outline"
              className="not-in-data-active:text-muted-foreground"
            >
              {item.count}
            </Badge>
          </TabsTab>
        ))}
      </TabsList>
      {items
        .filter((item) => item.content !== undefined)
        .map((item) => (
          <TabsPanel key={item.value} value={item.value}>
            {item.content}
          </TabsPanel>
        ))}
    </Tabs>
  );
}

export default PTabs10;
