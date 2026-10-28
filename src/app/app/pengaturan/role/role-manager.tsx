"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Table, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Trash2, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getRoles, createRole, updateRole, deleteRole, type RoleRow } from "@/app/app/pengaturan/role/actions";
import { BASE_ROLE_LABEL, type PermissionKey } from "@/lib/auth/permissions";

type RoleFormData = {
  key: string;
  name: string;
  baseRole: string;
  permissions: PermissionKey[];
};

type Props = {
  roles: RoleRow[];
  baseCatalog: Array<{ baseRole: string; label: string; permissions: string[] }>;
  permissionGroups: Array<{ group: string; label: string; permissions: Array<{ key: string; label: string }> }>;
};

export function RoleManager({ roles, baseCatalog, permissionGroups }: Props) {
  const t = useTranslations("pengaturan");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const onNew = () => setOpenKey("__new__");
  const onEdit = (k: string) => setOpenKey(k);
  const onClose = () => setOpenKey(null);

  const editing = openKey !== null ? roles.find((r) => r.key === openKey) : null;

  const onSubmit = async (data: RoleFormData) => {
    setIsBusy(true);
    try {
      if (openKey === "__new__") {
        await createRole({
          key: data.key,
          name: data.name,
          baseRole: data.baseRole,
          permissions: data.permissions,
        });
      } else if (editing) {
        await updateRole({
          key: openKey,
          name: data.name,
          baseRole: data.baseRole,
          permissions: data.permissions,
        });
      }
      onClose();
      setToast({ kind: "ok", msg: t("saved") });
      await refresh();
    } catch (e: any) {
      setToast({ kind: "err", msg: e?.message ?? t("failed") });
    } finally {
      setIsBusy(false);
    }
  };

  const confirmDelete = async (k: string) => {
    if (!window.confirm(`${t("delete_confirm", { role: k })}`)) return;
    setIsBusy(true);
    try {
      await deleteRole(k);
      await refresh();
      setToast({ kind: "ok", msg: t("deleted") });
    } catch (e: any) {
      setToast({ kind: "err", msg: e?.message ?? t("failed") });
    } finally {
      setIsBusy(false);
    }
  };

  const onEdit = (k: string) => setOpenKey(k);
  const onClose = () => setOpenKey(null);

  const refresh = async () => {
    await getRoles();
  }

  const baseRole = editing?.baseRole ?? baseCatalog[0].baseRole;
  const allowedPermissions = baseCatalog
    .find((b) => b.baseRole === baseRoleFromCurrent)
    ?.permissions ?? [];

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="px-8 py-4 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
          </div>
          <Button onClick={onNew}>{t("create_role")}</Button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-8 py-8">
        {roles.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableCell className="font-medium text-left">{t("records")}</TableCell>
              </TableRow>
            </TableHeader>
            <tbody>
              {roles.map((r) => (
                <TableRow key={r.key} className="border-t">
                  <TableCell className="font-mono text-sm">{r.key}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {BASE_ROLE_LABEL[r.baseRole] ?? r.baseRole}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.permissions.length}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="outline" onClick={() => onEdit(r.key)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => confirmDelete(r.key)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {openKey !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-full">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-semibold">
                {isNew ? t("create_role") : t("edit_role")}
              </h2>
              <button onClick={onClose} className="text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm mb-1">{t("key_label")}</label>
                <Input
                  placeholder={isNew ? t("default_key") : editing?.key ?? ""}
                  defaultValue={editing?.key ?? ""}
                  disabled={!isNew}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">{t("name_label")}</label>
                <Input
                  placeholder={t("name_placeholder")}
                  defaultValue={editing?.name ?? ""}
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">{t("base_role_label")}</label>
                <Select defaultValue={editing?.baseRole ?? baseCatalog[0].baseRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {baseCatalog.map((bc) => (
                      <SelectItem key={bc.baseRole} value={bc.baseRole}>
                        {bc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <span className="text-sm font-medium block mb-2">{t("permissions_label")}</span>
                {permissionGroups.map((gp) => (
                  <div key={gp.group} className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">{gp.label}</span>
                    {gp.permissions.map((p) => (
                      <label
                        key={p.key}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded accent-brand-600"
                          readOnly={!allowedPermissions.includes(p.key)}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" onClick={onClose}>
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={isBusy}>
                  {isNew ? t("create") : t("save")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-white rounded-lg shadow p-2 text-sm text-center">
          {toast.kind === "ok" ? (
            <span className="text-green-600">{toast.msg}</span>
          ) : (
            <span className="text-destructive">{toast.msg}</span>
          )}
        </div>
      )}
    </div>
  );
}

const t = useTranslations("pengaturan");
const allowedSet = new Set(permissionGroups.flatMap((g) => g.permissions.map((p) => p.key)));