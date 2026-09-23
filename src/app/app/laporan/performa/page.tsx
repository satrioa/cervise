import { EllipsisIcon, StarIcon, WrenchIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { PerformaExport } from "@/components/performa-export";

type TeknisiRow = {
  name: string;
  initials: string;
  tone: string;
  cabang: string;
  selesai: number;
  rating: number;
};

const TEKNISI: TeknisiRow[] = [
  { name: "Rudi Teknisi", initials: "RT", tone: "bg-violet-500/15 text-violet-600 dark:text-violet-300", cabang: "Cervise Pusat", selesai: 12, rating: 4.8 },
  { name: "Sari Teknisi", initials: "ST", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-300", cabang: "Cervise Cabang 2", selesai: 7, rating: 4.6 },
  { name: "Eko Teknisi", initials: "ET", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", cabang: "Cervise Pusat", selesai: 9, rating: 4.7 },
  { name: "Andi Teknisi", initials: "AT", tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300", cabang: "Cervise Cabang 3", selesai: 5, rating: 4.5 },
];

export default function PerformaPage() {
  return (
    <div className="min-h-svh bg-background px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-xl">Performa Teknisi</h1>
            <p className="text-muted-foreground text-sm">
              {TEKNISI.length} teknisi · metrik: Selesai + Sudah Diambil = selesai · filter tanggal & cabang
            </p>
          </div>
          <PerformaExport
            rows={TEKNISI.map((t) => ({
              name: t.name,
              cabang: t.cabang,
              selesai: t.selesai,
              rating: t.rating,
            }))}
          />
        </header>

        <div className="rounded-xl border bg-card shadow-xs/5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">Teknisi</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Selesai</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="pe-4 w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {TEKNISI.map((t) => (
                <TableRow key={t.name}>
                  <TableCell className="ps-4">
                    <div className="flex items-center gap-3">
                      <Avatar className={"size-8 " + t.tone}>
                        <AvatarFallback className="bg-transparent font-medium text-[11px]">{t.initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-muted-foreground text-xs flex items-center gap-1">
                          <WrenchIcon className="size-3" /> Teknisi
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.cabang}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" size="sm" className="font-mono tabular-nums">
                      {t.selesai} servis
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="inline-flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      <StarIcon className="size-3 text-amber-500" />
                      <span className="font-mono text-xs tabular-nums">{t.rating.toFixed(1)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="pe-4">
                    <Menu>
                      <MenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions ${t.name}`} />}>
                        <EllipsisIcon />
                      </MenuTrigger>
                      <MenuPopup align="end">
                        <MenuItem>Lihat detail</MenuItem>
                        <MenuItem>Riwayat servis</MenuItem>
                      </MenuPopup>
                    </Menu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
