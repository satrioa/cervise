"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { XIcon, PlusIcon } from "lucide-react";
import { KELENGKAPAN_DEFAULT } from "@/lib/servis-constants";

type Props = {
  value: string[];
  onChange: (v: string[]) => void;
};

export function KelengkapanSelect({ value, onChange }: Props) {
  const [custom, setCustom] = useState("");

  const allOptions = [...KELENGKAPAN_DEFAULT] as string[];

  const toggle = (name: string, checked: boolean) => {
    if (checked) onChange([...value, name]);
    else onChange(value.filter((v) => v !== name));
  };

  const addCustom = () => {
    const t = custom.trim();
    if (!t) return;
    if (value.includes(t)) return;
    onChange([...value, t]);
    setCustom("");
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {allOptions.map((opt) => (
          <label key={opt} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30">
            <Checkbox checked={value.includes(opt)} onCheckedChange={(c) => toggle(opt, Boolean(c))} />
            <span className="truncate">{opt}</span>
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <Input placeholder="Custom (misal: Kabel Data)" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); }}} />
        <Button type="button" variant="outline" size="sm" onClick={addCustom}>
          <PlusIcon className="size-3.5" /> Tambah
        </Button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <Badge key={v} variant="secondary" className="pr-1 gap-1">
              {v}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="rounded p-0.5 hover:bg-foreground/10">
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
