"use client";

import { useEffect, useState } from "react";
import { SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { updatePromoSettings } from "@/app/owner/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type PromoSettings = {
  promo_title: string;
  promo_headline: string;
  promo_subtext: string;
  promo_price: string;
  promo_included: string[];
  promo_separate: string[];
  promo_note: string;
  promo_ends_at: string;
};

function localInputValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PromoSettingsForm({ settings }: { settings: PromoSettings }) {
  const [endsAt, setEndsAt] = useState("");
  const [title, setTitle] = useState(settings.promo_title);
  const [headline, setHeadline] = useState(settings.promo_headline);
  const [subtext, setSubtext] = useState(settings.promo_subtext);
  const [price, setPrice] = useState(settings.promo_price);
  const [included, setIncluded] = useState(settings.promo_included.join("\n"));
  const [separate, setSeparate] = useState(settings.promo_separate.join("\n"));
  const [note, setNote] = useState(settings.promo_note);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEndsAt(localInputValue(settings.promo_ends_at));
  }, [settings.promo_ends_at]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updatePromoSettings({ endsAtLocal: endsAt, title, headline, subtext, price, included, separate, note });
      playPageTransition();
      toast.success("Special Promo disimpan");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan promo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="max-w-2xl space-y-4" onSubmit={submit}>
      <div className="space-y-1.5">
        <Label htmlFor="promo-ends">Berakhir pada</Label>
        <Input id="promo-ends" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="promo-title">Judul section</Label><Input id="promo-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="promo-price">Harga</Label><Input id="promo-price" value={price} onChange={(event) => setPrice(event.target.value)} /></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="promo-headline">Headline card</Label><Input id="promo-headline" value={headline} onChange={(event) => setHeadline(event.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="promo-subtext">Sub teks</Label><Textarea id="promo-subtext" value={subtext} onChange={(event) => setSubtext(event.target.value)} rows={2} /></div>
      <div className="space-y-1.5"><Label htmlFor="promo-included">What&apos;s included (1 poin per baris)</Label><Textarea id="promo-included" value={included} onChange={(event) => setIncluded(event.target.value)} rows={7} /></div>
      <div className="space-y-1.5"><Label htmlFor="promo-separate">Separate charges (1 poin per baris)</Label><Textarea id="promo-separate" value={separate} onChange={(event) => setSeparate(event.target.value)} rows={3} /></div>
      <div className="space-y-1.5"><Label htmlFor="promo-note">Catatan hosting</Label><Textarea id="promo-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} /></div>
      <Button type="submit" loading={saving}><SaveIcon className="size-4" /> Simpan promo</Button>
    </form>
  );
}
