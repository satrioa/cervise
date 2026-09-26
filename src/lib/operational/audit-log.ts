export type AuditLogInput = {
  id: string;
  created_at: string;
  action: string;
  from_value: string | null;
  to_value: string | null;
  payload: Record<string, unknown> | null;
  servis_id: string | null;
  branch_id: string;
  actor_id: string | null;
};

export type AuditRow = {
  id: string;
  createdAt: string;
  action: string;
  actionLabel: string;
  actorId: string | null;
  actorName: string;
  actorRole: string | null;
  resource: string;
  branchName: string;
};

const ACTION_LABELS: Record<string, string> = {
  create: "Servis dibuat",
  edit_field: "Field servis diubah",
  extend_garansi: "Garansi diperpanjang",
  delete: "Servis dihapus",
};

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function auditInitials(name: string): string {
  return name === "System" ? "•" : initialsOf(name);
}

/**
 * `to_value` holds the most human-readable thing each action logs (a device
 * label on create, a field diff on edit). Falls back to the service id so a row
 * is never blank.
 */
function describeResource(log: AuditLogInput): string {
  const toValue = log.to_value?.trim();
  if (toValue) return toValue;
  const payload = log.payload ?? {};
  const keys = Object.keys(payload);
  if (keys.length > 0) {
    return keys
      .slice(0, 3)
      .map((key) => `${key}: ${JSON.stringify(payload[key])}`)
      .join(", ")
      .slice(0, 200);
  }
  return log.servis_id ?? "—";
}

export function mapAuditRows(input: {
  logs: AuditLogInput[];
  actors: { id: string; full_name: string | null; role: string | null }[];
  branches: { id: string; name: string }[];
}): AuditRow[] {
  const actorsById = new Map(input.actors.map((actor) => [actor.id, actor]));
  const branchesById = new Map(input.branches.map((branch) => [branch.id, branch.name]));

  return [...input.logs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((log) => {
      const actor = log.actor_id ? actorsById.get(log.actor_id) : null;
      return {
        id: log.id,
        createdAt: log.created_at,
        action: log.action,
        actionLabel: auditActionLabel(log.action),
        actorId: log.actor_id,
        actorName: !log.actor_id ? "System" : actor?.full_name?.trim() || "Tanpa nama",
        actorRole: actor?.role ?? null,
        resource: describeResource(log),
        branchName: branchesById.get(log.branch_id) ?? "—",
      };
    });
}

export function auditActionsFrom(rows: AuditRow[]): string[] {
  return Array.from(new Set(rows.map((row) => row.action)));
}

export function filterAuditRows(
  rows: AuditRow[],
  filters: { search?: string; actions?: string[]; actorIds?: string[]; from?: Date; to?: Date },
): AuditRow[] {
  const { search, actions, actorIds, from, to } = filters;
  const needle = search?.trim().toLowerCase();

  return rows.filter((row) => {
    if (needle) {
      const haystack = `${row.actorName} ${row.actionLabel} ${row.resource}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (actions && actions.length > 0 && !actions.includes(row.action)) return false;
    if (actorIds && actorIds.length > 0 && (!row.actorId || !actorIds.includes(row.actorId))) return false;
    if (from || to) {
      const at = new Date(row.createdAt).getTime();
      if (from && at < from.getTime()) return false;
      if (to && at > to.getTime()) return false;
    }
    return true;
  });
}
