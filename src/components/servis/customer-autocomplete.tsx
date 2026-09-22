"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { searchCustomers } from "@/app/app/servis/actions";

type Customer = { id: string; name: string; phone: string; address: string | null };

type Props = {
  name: string;
  phone: string;
  address: string;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onSelectExisting?: (c: Customer) => void;
};

export function CustomerAutocomplete({ name, phone, address, onNameChange, onPhoneChange, onAddressChange }: Props) {
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!name.trim() || name.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await searchCustomers(name.trim());
        setSuggestions(res as Customer[]);
        setOpen(res.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [name]);

  const pick = (c: Customer) => {
    onNameChange(c.name);
    onPhoneChange(c.phone);
    onAddressChange(c.address || "");
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative space-y-1.5 sm:col-span-2">
          <Label>Nama Customer *</Label>
          <Input placeholder="Ketik nama (autocomplete jika sudah ada)" value={name} onChange={(e) => onNameChange(e.target.value)} onFocus={() => suggestions.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
          {open && suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-popover shadow-lg">
              {suggestions.map((c) => (
                <button key={c.id} type="button" onMouseDown={() => pick(c)} className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.phone} {c.address ? `· ${c.address}` : ""}</span>
                </button>
              ))}
            </div>
          )}
          <p className="font-mono text-[10px] text-muted-foreground">Jika nama sudah ada → pilih, otomatis isi WA & alamat. Jika belum → akan buat customer baru.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Kontak Whatsapp *</Label>
          <Input placeholder="08xxxxxxxxxx" value={phone} onChange={(e) => onPhoneChange(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Alamat (Opsional)</Label>
          <Input placeholder="Alamat" value={address} onChange={(e) => onAddressChange(e.target.value)} />
        </div>
      </div>
    </div>
  );
}
