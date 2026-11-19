import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

// Render elemen dari Server Component tiba di client sebagai lazy wrapper
// yang tidak punya `.props`. Slot di-mock supaya fokus ke pengamanan akses
// `render.props` di Button, bukan mekanisme render React itu sendiri.
vi.mock("@radix-ui/react-slot", () => ({
  Slot: () => null,
}));

describe("Button dengan render prop dari Server Component", () => {
  it("tidak crash saat render tidak memiliki props", () => {
    const lazyLike = {} as never;

    expect(() =>
      renderToStaticMarkup(<Button render={lazyLike}>Kategori</Button>),
    ).not.toThrow();
  });
});
