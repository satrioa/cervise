import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

/**
 * `NoteWithMentions` dirender di dalam tombol judul pada kartu To-Do. Kalau
 * chip mention-nya elemen button, HTML-nya jadi button di dalam button -
 * HTML yang tidak valid. Browser menutup tombol luar lebih dulu, jadi DOM
 * yang dirender bukan yang ditulis server dan hydration React gagal.
 *
 * Test ini merender komponennya sungguhan lalu memeriksa markup hasilnya,
 * bukan hanya membaca source: bentuk HTML yang benar-benar dikirim ke
 * browser adalah yang diuji.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { NoteWithMentions } from "./mention-composer-input";

const mention = {
  mentionId: "mention-1",
  token: "z9zesc",
  todoId: "todo-1",
  kind: "customer" as const,
  id: "customer-1",
  label: "Satrio Adib",
  sub: "089531467668",
};

/**
 * Hitung Kedalaman button yang masih terbuka.
 *
 * Setiap `<button>` menambah satu, setiap `</button>` mengurangi satu. Kalau
 * ada button yang dibuka di dalam button lain, kedalamannya pernah naik ke 2
 * (atau lebih) - persis kondisi yang membuat browser menutup tag lebih dulu.
 */
function maxNestedButtonDepth(html: string): number {
  const tokens = html.match(/<\/?button\b/g) ?? [];
  let depth = 0;
  let max = 0;
  for (const token of tokens) {
    if (token.startsWith("</")) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    depth += 1;
    max = Math.max(max, depth);
  }
  return max;
}

describe("chip mention di dalam tombol judul", () => {
  const html = renderToStaticMarkup(
    createElement(NoteWithMentions, {
      value: "{{m:z9zesc}}Cek Kerusakan",
      mentions: [mention],
    }),
  );

  it("tidak pernah membungkus button di button lain", () => {
    // Tanpa chip, tidak ada button sama sekali -> kedalaman 0.
    expect(maxNestedButtonDepth(html)).toBeLessThanOrEqual(1);
    expect(html).not.toContain("<button");
  });

  it("chip tetap bisa diklik dan dibaca screen reader", () => {
    // Peran button dipertahankan: chip harus tetap menjadi target klik dan
    // announced sebagai tombol, bukan sekadar teks.
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    // Label mention, bukan token mentah.
    expect(html).toContain("Satrio Adib");
    expect(html).not.toContain("{{m:z9zesc}}");
  });

  it("tombol judul membungkus chip tanpa menjadi button di dalam button", () => {
    // Bentuk yang dipakai dashboard: tombol judul (toggling) membungkus
    // chip. Di sinilah nesting itu pernah terjadi.
    const wrapped = renderToStaticMarkup(
      createElement(
        "button",
        { type: "button" },
        createElement(NoteWithMentions, {
          value: "{{m:z9zesc}}Cek Kerusakan",
          mentions: [mention],
        }),
      ),
    );
    expect(maxNestedButtonDepth(wrapped)).toBe(1);
  });
});
