import { EllipsisIcon, FileTextIcon, PrinterIcon, SendIcon, UserPlusIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";

type InvoiceRow = {
  no: string;
  servis: string;
  device: string;
  customer: string;
  initials: string;
  tone: string;
  nominal: number;
  status: "Lunas" | "Belum";
};

const INVOICES: InvoiceRow[] = [
  { no: "INV-2026-001", servis: "SV-001", device: "iPhone 11", customer: "Rina", initials: "RH", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-300", nominal: 350000, status: "Lunas" },
  { no: "INV-2026-002", servis: "SV-002", device: "Samsung A54", customer: "Agus", initials: "AP", tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300", nominal: 250000, status: "Belum" },
  { no: "INV-2026-003", servis: "SV-003", device: "Oppo Reno 8", customer: "Dewi", initials: "DL", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300", nominal: 180000, status: "Lunas" },
  { no: "INV-2026-004", servis: "SV-004", device: "Vivo Y20", customer: "Bambang", initials: "BW", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-300", nominal: 420000, status: "Belum" },
];

export default function InvoicePage() {
  return (
    <div className="min-h-svh bg-background px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-xl">Invoice</h1>
            <p className="text-muted-foreground text-sm">{INVOICES.length} invoice · per servis, cetak PDF, status lunas/belum</p>
          </div>
          <Button size="sm">
            <FileTextIcon />
            Buat Invoice
          </Button>
        </header>

        <div className="rounded-xl border bg-card shadow-xs/5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">No Invoice</TableHead>
                <TableHead>Servis</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pe-4 w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {INVOICES.map((inv) => (
                <TableRow key={inv.no}>
                  <TableCell className="ps-4">
                    <div className="flex items-center gap-2">
                      <FileTextIcon className="size-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs">{inv.no}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-medium">{inv.servis}</span>
                      <span className="text-muted-foreground text-xs">{inv.device}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className={"size-8 " + inv.tone}>
                        <AvatarFallback className="bg-transparent font-medium text-[11px]">{inv.initials}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{inv.customer}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">Rp {inv.nominal.toLocaleString("id-ID")}</TableCell>
                  <TableCell>
                    {inv.status === "Lunas" ? (
                      <Badge variant="success" className="gap-1">
                        Lunas
                      </Badge>
                    ) : (
                      <Badge variant="outline" size="sm" className="font-mono text-[10px] uppercase tracking-wider">
                        Belum
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="pe-4">
                    <Menu>
                      <MenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions ${inv.no}`} />}>
                        <EllipsisIcon />
                      </MenuTrigger>
                      <MenuPopup align="end">
                        <MenuItem>
                          <PrinterIcon /> Cetak PDF
                        </MenuItem>
                        <MenuItem>
                          <SendIcon /> Kirim WA
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem>Lihat servis</MenuItem>
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
