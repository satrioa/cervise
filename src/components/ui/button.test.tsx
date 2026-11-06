import { renderToStaticMarkup } from "react-dom/server";
import Link from "next/link";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

/**
 * `render` dipakai untuk mengganti elemen tombol (mis. jadi <a>/<Link>).
 * Dulu children milik Button tidak diteruskan ke elemen render, sehingga
 * `<Button render={<Link href="..." />}>Kategori</Button>` tampil sebagai
 * kotak kosong tanpa label maupun ikon.
 */
describe("Button dengan render prop", () => {
  it("meneruskan label ke elemen render yang belum punya children", () => {
    const html = renderToStaticMarkup(
      <Button render={<Link href="/app/kategori-sparepart" />}>Kategori</Button>,
    );

    expect(html).toContain("Kategori");
    expect(html).toContain('href="/app/kategori-sparepart"');
  });

  it("tidak menggandakan label saat elemen render sudah punya children", () => {
    const html = renderToStaticMarkup(
      <Button render={<Link href="/app">Dashboard</Link>}>Dashboard</Button>,
    );

    expect(html.match(/Dashboard/g)).toHaveLength(1);
  });
});
