import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  filterAuditRows,
  mapAuditRows,
  type AuditLogInput,
  type AuditRow,
} from "./audit-log";

// Fixtures are built from local calendar parts so assertions hold in any timezone.
const at = (day: number, hour: number) => new Date(2026, 8, day, hour).toISOString();

function log(overrides: Partial<AuditLogInput> = {}): AuditLogInput {
  return {
    id: "log-1",
    created_at: at(23, 9),
    action: "create",
    from_value: null,
    to_value: "iPhone 13 Pro",
    payload: {},
    servis_id: "svc-1",
    branch_id: "branch-1",
    actor_id: "user-1",
    ...overrides,
  };
}

function row(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    id: "log-1",
    createdAt: at(23, 9),
    action: "create",
    actionLabel: "Servis dibuat",
    actorId: "user-1",
    actorName: "Rina",
    actorRole: "FRONTLINER",
    resource: "iPhone 13 Pro",
    branchName: "Cervise Pusat",
    ...overrides,
  };
}

describe("auditActionLabel", () => {
  it("labels the actions the app actually writes", () => {
    expect(auditActionLabel("create")).toBe("Servis dibuat");
    expect(auditActionLabel("edit_field")).toBe("Field servis diubah");
    expect(auditActionLabel("extend_garansi")).toBe("Garansi diperpanjang");
  });

  it("labels the status and sparepart actions written by the database RPCs", () => {
    expect(auditActionLabel("status_change")).toBe("Status servis diubah");
    expect(auditActionLabel("add_sparepart")).toBe("Sparepart ditambahkan");
    expect(auditActionLabel("return_sparepart")).toBe("Sparepart dikembalikan ke stok");
    expect(auditActionLabel("keep_sparepart")).toBe("Sparepart ditandai tetap terpakai");
  });

  it("falls back to the raw action for anything unknown", () => {
    expect(auditActionLabel("mystery_action")).toBe("mystery_action");
  });
});

describe("mapAuditRows", () => {
  const actors = [{ id: "user-1", full_name: "Rina", role: "FRONTLINER" }];
  const branches = [{ id: "branch-1", name: "Cervise Pusat" }];

  it("joins the actor and branch onto each log", () => {
    const result = mapAuditRows({ logs: [log()], actors, branches });

    expect(result[0]).toMatchObject({
      actorName: "Rina",
      actorRole: "FRONTLINER",
      branchName: "Cervise Pusat",
      actionLabel: "Servis dibuat",
      resource: "iPhone 13 Pro",
    });
  });

  it("marks a system entry when there is no actor", () => {
    const result = mapAuditRows({ logs: [log({ actor_id: null })], actors, branches });
    expect(result[0]).toMatchObject({ actorName: "System", actorRole: null });
  });

  it("marks a deleted actor without dropping the entry", () => {
    const result = mapAuditRows({ logs: [log()], actors: [], branches });
    expect(result[0].actorName).toBe("Tanpa nama");
  });

  it("labels an unknown branch instead of hiding the entry", () => {
    const result = mapAuditRows({ logs: [log()], actors, branches: [] });
    expect(result[0].branchName).toBe("—");
  });

  it("describes the changed fields when there is no device label", () => {
    const result = mapAuditRows({
      logs: [log({ action: "edit_field", to_value: "price: 0, garansi_value: 90" })],
      actors,
      branches,
    });

    expect(result[0].resource).toContain("price");
  });

  it("falls back to the service id when nothing descriptive was logged", () => {
    const result = mapAuditRows({
      logs: [log({ to_value: null, payload: {}, action: "edit_field" })],
      actors,
      branches,
    });

    expect(result[0].resource).toBe("svc-1");
  });

  it("sorts newest first", () => {
    const result = mapAuditRows({
      logs: [log({ id: "older", created_at: at(20, 9) }), log({ id: "newer", created_at: at(23, 9) })],
      actors,
      branches,
    });

    expect(result.map((entry) => entry.id)).toEqual(["newer", "older"]);
  });

  it("returns an empty list when nothing has been logged", () => {
    expect(mapAuditRows({ logs: [], actors, branches })).toEqual([]);
  });
});

describe("filterAuditRows", () => {
  const rows = [
    row({ id: "a", actorName: "Rina", action: "create", actionLabel: "Servis dibuat", resource: "iPhone 13", createdAt: at(23, 9) }),
    row({ id: "b", actorId: "user-budi", actorName: "Budi", action: "edit_field", actionLabel: "Field servis diubah", resource: "LCD retak", createdAt: at(22, 9) }),
    row({ id: "c", actorId: "user-sari", actorName: "Sari", action: "extend_garansi", actionLabel: "Garansi diperpanjang", resource: "30 hari", createdAt: at(10, 9) }),
  ];

  it("returns everything when no filter is active", () => {
    expect(filterAuditRows(rows, {})).toHaveLength(3);
  });

  it("searches across actor, action and resource", () => {
    expect(filterAuditRows(rows, { search: "budi" }).map((r) => r.id)).toEqual(["b"]);
    expect(filterAuditRows(rows, { search: "lcd" }).map((r) => r.id)).toEqual(["b"]);
    expect(filterAuditRows(rows, { search: "garansi" }).map((r) => r.id)).toEqual(["c"]);
  });

  it("ignores surrounding whitespace in the search", () => {
    expect(filterAuditRows(rows, { search: "   budi   " }).map((r) => r.id)).toEqual(["b"]);
  });

  it("filters by a set of actions", () => {
    expect(filterAuditRows(rows, { actions: ["create"] }).map((r) => r.id)).toEqual(["a"]);
    expect(filterAuditRows(rows, { actions: ["create", "edit_field"] }).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("filters by actor id", () => {
    expect(filterAuditRows(rows, { actorIds: ["user-budi"] }).map((r) => r.id)).toEqual(["b"]);
  });

  it("filters by a time window", () => {
    const from = new Date(2026, 8, 22, 0, 0);
    expect(filterAuditRows(rows, { from }).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("combines filters", () => {
    expect(filterAuditRows(rows, { actions: ["create"], search: "sari" })).toEqual([]);
  });
});

describe("audit action options", () => {
  it("derives the action options from the data", () => {
    const rows = [row({ action: "create" }), row({ action: "create" }), row({ action: "extend_garansi" })];
    const actions = [...new Set(rows.map((entry) => entry.action))];
    expect(actions).toEqual(["create", "extend_garansi"]);
  });
});
