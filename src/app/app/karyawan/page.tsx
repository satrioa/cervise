import { EllipsisIcon, MailIcon, ShieldIcon, TrashIcon, UserPlusIcon, PencilIcon, UserMinusIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Role = "master_admin" | "admin" | "frontliner" | "teknisi";

const ROLES: { label: string; value: Role }[] = [
  { label: "Master Admin", value: "master_admin" },
  { label: "Admin", value: "admin" },
  { label: "Frontliner", value: "frontliner" },
  { label: "Teknisi", value: "teknisi" },
];

interface Karyawan {
  name: string;
  email: string;
  initials: string;
  tone: string;
  role: Role;
  cabang: string;
  status: string;
  aktif: boolean;
  pending?: boolean;
}

const KARYAWAN: Karyawan[] = [
  { name: "Budi Santoso", email: "budi@cervise.id", initials: "BS", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300", role: "master_admin", cabang: "Cervise Pusat", status: "Aktif sekarang", aktif: true },
  { name: "Siti Admin", email: "siti@cervise.id", initials: "SA", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-300", role: "admin", cabang: "Cervise Pusat", status: "2j lalu", aktif: true },
  { name: "Andi Frontliner", email: "andi@cervise.id", initials: "AF", tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300", role: "frontliner", cabang: "Cervise Pusat", status: "1j lalu", aktif: true },
  { name: "Rudi Teknisi", email: "rudi@cervise.id", initials: "RT", tone: "bg-violet-500/15 text-violet-600 dark:text-violet-300", role: "teknisi", cabang: "Cervise Pusat", status: "Kemarin", aktif: true },
  { name: "Sari Teknisi", email: "sari@cervise.id", initials: "ST", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-300", role: "teknisi", cabang: "Cervise Cabang 2", status: "3 hari lalu", aktif: false, pending: true },
];

export default function KaryawanPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Karyawan · 1 user 1 cabang</div>
            <h1 className="mt-1 font-heading text-2xl">Data Karyawan</h1>
          </div>
          <Button size="sm">
            <UserPlusIcon /> Tambah Karyawan
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-10 py-8">
        <div className="rounded-xl border bg-card shadow-xs/5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">Karyawan</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Terakhir aktif</TableHead>
                <TableHead className="pe-4 w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {KARYAWAN.map((m) => (
                <TableRow key={m.email}>
                  <TableCell className="ps-4">
                    <div className="flex items-center gap-3">
                      <Avatar className={"size-8 " + m.tone}>
                        <AvatarFallback className="bg-transparent font-medium text-[11px]">{m.initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{m.name}</span>
                          {m.pending ? (
                            <Badge variant="outline" size="sm" className="font-mono text-[9px] uppercase tracking-wider">pending</Badge>
                          ) : null}
                        </div>
                        <div className="text-muted-foreground text-xs">{m.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.cabang}</TableCell>
                  <TableCell>
                    {m.role === "master_admin" ? (
                      <Badge variant="outline" className="gap-1">
                        <ShieldIcon className="size-3" /> Master Admin
                      </Badge>
                    ) : (
                      <Select items={ROLES} defaultValue={m.role}>
                        <SelectTrigger className="h-8 w-36 text-sm" size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectPopup>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectPopup>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="inline-flex items-center gap-1.5">
                      <span className={"size-1.5 rounded-full " + (m.aktif ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                      <span className="text-muted-foreground text-xs">{m.aktif ? "Aktif" : "Nonaktif"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums text-sm">{m.status}</TableCell>
                  <TableCell className="pe-4">
                    <Menu>
                      <MenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${m.name}`} />}>
                        <EllipsisIcon />
                      </MenuTrigger>
                      <MenuPopup align="end">
                        <MenuItem><PencilIcon /> Edit data</MenuItem>
                        <MenuItem><MailIcon /> Kirim reset password</MenuItem>
                        <MenuItem><UserMinusIcon /> Nonaktifkan</MenuItem>
                        <MenuSeparator />
                        <MenuItem variant="destructive"><TrashIcon /> Hapus karyawan</MenuItem>
                      </MenuPopup>
                    </Menu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Style disalin dari <span className="font-mono">src/components/table-members.tsx:64</span> — Invite → Tambah Karyawan, Team → Cabang, 2FA → Status Aktif.</p>
      </main>
    </div>
  );
}
