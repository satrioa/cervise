"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Table, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { TableBody, TableHead } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { getRoles, createRole, updateRole, deleteRole, type RoleRow } from "@/app/app/pengaturan/role/actions";
import {
  BASE_ROLE_LABEL,
  isPermissionKey,
  type CustomBaseRole,
  type PermissionKey,
} from "@/lib/auth/permissions";
import { playPageTransition } from "@/components/layout/page-transition";

type FormState = {
  key: string;
  name: string;
  baseRole: CustomBaseRole;
  permissions: PermissionKey[];
};

type Props = {
  roles: RoleRow[];
  baseCatalog: Array<{ baseRole: CustomBaseRole; label: string; permissions: PermissionKey[] }>;
  permissionGroups: Array<{ group: string; label: string; permissions: Array<{ key: PermissionKey; label: string }> }>;
};

export function RoleManager({ roles, baseCatalog, permissionGroups }: Props) {
  const t = useTranslations("pengaturan");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);

  const isNew = openKey === "__new__";
  const editing = openKey && !isNew ? roles.find((r) => r.key === openKey) ?? null : null;

  const openForm = (key: string) => {
    const row = key === "__new__" ? null : roles.find((r) => r.key === key) ?? null;
    setOpenKey(key);
    setForm(
      row
        ? {
            key: row.key,
            name: row.name,
            baseRole: row.baseRole,
            permissions: row.permissions.filter(isPermissionKey),
          }
        : { key: "", name: "", baseRole: baseCatalog[0].baseRole, permissions: [] },
    );
  };

  const allowedPermissions =
    baseCatalog.find((b) => b.baseRole === form?.baseRole)?.permissions ?? [];

  const changeBaseRole = (value: CustomBaseRole) => {
    if (!form) return;
    const allowed = new Set(baseCatalog.find((b) => b.baseRole === value)?.permissions ?? []);
    setForm({
      ...form,
      baseRole: value,
      permissions: form.permissions.filter((p) => allowed.has(p)),
    });
  };

  const togglePermission = (key: PermissionKey) => {
    if (!form || !allowedPermissions.includes(key)) return;
    setForm({
      ...form,
      permissions: form.permissions.includes(key)
        ? form.permissions.filter((p) => p !== key)
        : [...form.permissions, key],
    });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setIsBusy(true);
    try {
      if (isNew) {
        await createRole({
          key: form.key.trim().toUpperCase(),
          name: form.name.trim(),
          baseRole: form.baseRole,
          permissions: form.permissions,
        });
      } else if (editing) {
        await updateRole({
          key: editing.key,
          name: form.name.trim(),
          baseRole: form.baseRole,
          permissions: form.permissions,
        });
      }
      setOpenKey(null);
      setForm(null);
      playPageTransition();
      toast.success(t("saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failed"));
    } finally {
      setIsBusy(false);
    }
  };

  const performDelete = async () => {
    const k = deleteKey;
    if (!k) return;
    setIsBusy(true);
    try {
      await deleteRole(k);
      playPageTransition();
      toast.success(t("deleted"));
      setDeleteKey(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failed"));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="min-h-svh bg-background text-foreground">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={<Button onClick={() => openForm("__new__")}>{t("create_role")}</Button>}
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {roles.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">{t("records")}</TableHead>
                <TableHead>{t("name_label")}</TableHead>
                <TableHead>{t("base_role_label")}</TableHead>
                <TableHead>{t("permissions_label")}</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
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
                      <Button size="icon" variant="outline" onClick={() => openForm(r.key)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        disabled={isBusy}
                        onClick={() => setDeleteKey(r.key)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={form !== null} onOpenChange={(open) => !open && setOpenKey(null)}>
        <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-5 py-4">
            <DialogTitle>{isNew ? t("create_role") : t("edit_role")}</DialogTitle>
            <DialogDescription>{t("subtitle")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <Field>
                <FieldLabel htmlFor="role-key">{t("key_label")}</FieldLabel>
                <Input
                  id="role-key"
                  placeholder={isNew ? t("default_key") : editing?.key ?? ""}
                  value={form?.key ?? ""}
                  onChange={(e) => form && setForm({ ...form, key: e.target.value })}
                  disabled={!isNew}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="role-name">{t("name_label")}</FieldLabel>
                <Input
                  id="role-name"
                  placeholder={t("name_placeholder")}
                  value={form?.name ?? ""}
                  onChange={(e) => form && setForm({ ...form, name: e.target.value })}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>{t("base_role_label")}</FieldLabel>
                <Select value={form?.baseRole} onValueChange={(value) => changeBaseRole(value as CustomBaseRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {baseCatalog.map((bc) => (
                        <SelectItem key={bc.baseRole} value={bc.baseRole}>
                          {bc.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <div className="space-y-3">
                <p className="text-sm font-medium">{t("permissions_label")}</p>
                {permissionGroups.map((gp) => (
                  <div key={gp.group} className="space-y-2 rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{gp.label}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {gp.permissions.map((p) => {
                        const allowed = allowedPermissions.includes(p.key);
                        return (
                          <label
                            key={p.key}
                            className={`flex items-start gap-2 text-sm ${allowed ? "" : "opacity-50"}`}
                          >
                            <Checkbox
                              checked={form?.permissions.includes(p.key) ?? false}
                              disabled={!allowed}
                              onCheckedChange={() => togglePermission(p.key)}
                              className="mt-0.5"
                            />
                            <span>{p.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter className="shrink-0 border-t px-5 py-3">
              <Button type="button" variant="outline" onClick={() => setOpenKey(null)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isBusy}>
                {isNew ? t("create") : t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteKey !== null} onOpenChange={(open) => !open && setDeleteKey(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("delete_confirm", { role: deleteKey ?? "" })}</DialogTitle>
            <DialogDescription>{t("subtitle")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteKey(null)}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="destructive" loading={isBusy} onClick={() => void performDelete()}>
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
