"use client";

import { useEffect, useState } from "react";
import { BellIcon } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/app/app/actions/notifications";

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    getNotifications()
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setUnread(result.unreadCount);
      })
      .catch(() => toast.error("Gagal memuat notifikasi"));
    return () => {
      active = false;
    };
  }, []);

  const openItem = async (item: NotificationItem) => {
    if (!item.read) {
      try {
        await markNotificationRead(item.id);
        setItems((prev) =>
          prev.map((row) => (row.id === item.id ? { ...row, read: true } : row)),
        );
        setUnread((count) => Math.max(0, count - 1));
      } catch {
        toast.error("Gagal menandai notifikasi");
      }
    }
    if (item.href) window.location.assign(item.href);
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((row) => ({ ...row, read: true })));
      setUnread(0);
    } catch {
      toast.error("Gagal menandai notifikasi");
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Notifikasi"
            className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          />
        }
      >
        <BellIcon className="size-4" fill="currentColor" />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
            {unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifikasi</span>
          <button
            type="button"
            onClick={() => void markAll()}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Tandai semua dibaca
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Belum ada notifikasi
            </p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openItem(item)}
                className={cn(
                  "block w-full border-b px-3 py-2 text-left last:border-0 hover:bg-muted/50",
                  !item.read && "bg-primary/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{item.title}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("id-ID")}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{item.body}</p>
                {item.branchLabel ? (
                  <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {item.branchLabel}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
