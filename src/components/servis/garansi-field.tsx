"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectPopup, SelectItem, SelectValue } from "@/components/ui/select";

type Props = {
  value: number | "";
  unit: "hari" | "bulan" | "tahun";
  onValueChange: (v: number | "") => void;
  onUnitChange: (u: "hari" | "bulan" | "tahun") => void;
};

export function GaransiField({ value, unit, onValueChange, onUnitChange }: Props) {
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <Input
          type="number"
          min={0}
          placeholder="0"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") onValueChange("");
            else onValueChange(Math.max(0, Number(v)));
          }}
        />
      </div>
      <Select value={unit} onValueChange={(v) => onUnitChange(v as "hari" | "bulan" | "tahun")}>
        <SelectTrigger className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          <SelectItem value="hari">Hari</SelectItem>
          <SelectItem value="bulan">Bulan</SelectItem>
          <SelectItem value="tahun">Tahun</SelectItem>
        </SelectPopup>
      </Select>
    </div>
  );
}
