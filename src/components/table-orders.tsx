import {
  CheckIcon,
  ChevronDownIcon,
  CircleDotIcon,
  PackageIcon,
  TruckIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Stage = "ordered" | "packed" | "shipped" | "delivered";

interface Order {
  id: string;
  customer: string;
  items: number;
  total: number;
  stage: Stage;
  carrier: string;
  eta: string;
  selected?: boolean;
}

const STAGES: { key: Stage; label: string; icon: typeof CheckIcon }[] = [
  { key: "ordered", label: "Ordered", icon: CircleDotIcon },
  { key: "packed", label: "Packed", icon: PackageIcon },
  { key: "shipped", label: "Shipped", icon: TruckIcon },
  { key: "delivered", label: "Delivered", icon: CheckIcon },
];

const ORDERS: Order[] = [
  { id: "#A-2841", customer: "Saoirse Walsh", items: 3, total: 184.5, stage: "delivered", carrier: "DHL", eta: "Apr 22" },
  { id: "#A-2840", customer: "Marcus Rivera", items: 1, total: 32.0, stage: "shipped", carrier: "UPS", eta: "Apr 27", selected: true },
  { id: "#A-2839", customer: "Lin Wei", items: 5, total: 412.9, stage: "shipped", carrier: "FedEx", eta: "Apr 28", selected: true },
  { id: "#A-2838", customer: "Pavel Doronin", items: 2, total: 96.0, stage: "packed", carrier: "USPS", eta: "Apr 29" },
  { id: "#A-2837", customer: "Aiyana Curtis", items: 1, total: 19.5, stage: "ordered", carrier: "—", eta: "Apr 30" },
  { id: "#A-2836", customer: "Daichi Watanabe", items: 4, total: 240.0, stage: "delivered", carrier: "DHL", eta: "Apr 21" },
];

const stageIndex = (s: Stage) => STAGES.findIndex((x) => x.key === s);
const selectedCount = ORDERS.filter((o) => o.selected).length;

export function TableOrdersShowcasePage() {
  return (
    <div className="min-h-svh bg-background px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-xl">Orders</h1>
            <p className="text-muted-foreground text-sm">
              Card-variant table · 6 of 248
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedCount > 0 ? (
              <div className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 shadow-xs/5">
                <span className="text-sm">{selectedCount} selected</span>
                <span className="text-muted-foreground/40">·</span>
                <Button size="xs" variant="ghost">Mark shipped</Button>
                <Button size="xs" variant="ghost">Print labels</Button>
              </div>
            ) : null}
            <Button size="sm" variant="outline">
              Sort by date
              <ChevronDownIcon />
            </Button>
          </div>
        </header>

        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead>
                <Checkbox aria-label="Select all" />
              </TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ORDERS.map((o) => (
              <TableRow key={o.id} data-state={o.selected ? "selected" : undefined}>
                <TableCell>
                  <Checkbox aria-label={`Select ${o.id}`} defaultChecked={o.selected} />
                </TableCell>
                <TableCell>
                  <div className="font-mono text-sm">{o.id}</div>
                  <div className="text-muted-foreground text-xs tabular-nums">ETA {o.eta}</div>
                </TableCell>
                <TableCell className="font-medium">{o.customer}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {o.items} item{o.items === 1 ? "" : "s"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <StageTrack stage={o.stage} />
                </TableCell>
                <TableCell className="text-muted-foreground">{o.carrier}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  ${o.total.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StageTrack({ stage }: { stage: Stage }) {
  const idx = stageIndex(stage);
  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((s, i) => {
        const Icon = s.icon;
        const reached = i <= idx;
        const current = i === idx;
        return (
          <div key={s.key} className="flex items-center gap-1.5">
            <div
              className={
                "flex size-5 items-center justify-center rounded-full border text-[10px] " +
                (current
                  ? "border-primary bg-primary text-primary-foreground"
                  : reached
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-border bg-muted text-muted-foreground/60")
              }
              aria-label={s.label}
            >
              <Icon className="size-3" />
            </div>
            {i < STAGES.length - 1 ? (
              <div
                className={
                  "h-px w-3 " + (i < idx ? "bg-emerald-500/40" : "bg-border")
                }
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
