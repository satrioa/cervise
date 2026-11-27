"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { createClient } from "@/lib/supabase/server";
import type { AppNotificationEvent } from "@/lib/notifications/app-notifications";

export type NotificationItem = {
  id: string;
  event: AppNotificationEvent;
  title: string;
  body: string;
  href: string | null;
  branchLabel: string | null;
  createdAt: string;
  read: boolean;
};
export type NotificationsResult = {
  items: NotificationItem[];
  unreadCount: number;
};

export async function getNotifications(): Promise<NotificationsResult> {
  const actor = await getActiveTenant();
  const supabase = await createClient();
  const isAdmin = actor.role === "MASTER_ADMIN" || actor.role === "ADMIN";

  let query = supabase
    .from("cervise_app_notifications")
    .select("id, event, title, body, href, branch_label, created_at")
    .eq("organization_id", actor.orgId)
    .contains("audience_roles", [actor.role])
    .order("created_at", { ascending: false })
    .limit(20);
  if (!isAdmin && actor.branchId) query = query.eq("branch_id", actor.branchId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const ids = rows.map((row) => String(row.id));
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  const readIds = new Set<string>();
  if (user && ids.length > 0) {
    const { data: reads } = await supabase
      .from("cervise_app_notification_reads")
      .select("notification_id")
      .eq("user_id", user.id)
      .in("notification_id", ids);
    for (const row of reads ?? []) readIds.add(String(row.notification_id));
  }

  const items: NotificationItem[] = rows.map((row) => ({
    id: String(row.id),
    event: row.event as AppNotificationEvent,
    title: String(row.title),
    body: String(row.body),
    href: row.href ? String(row.href) : null,
    branchLabel: row.branch_label ? String(row.branch_label) : null,
    createdAt: String(row.created_at),
    read: readIds.has(String(row.id)),
  }));
  return { items, unreadCount: items.filter((item) => !item.read).length };
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Sesi tidak valid");
  const { error } = await supabase.from("cervise_app_notification_reads").upsert({
    notification_id: id,
    user_id: user.id,
  });
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const result = await getNotifications();
  for (const item of result.items) {
    if (!item.read) await markNotificationRead(item.id);
  }
}
