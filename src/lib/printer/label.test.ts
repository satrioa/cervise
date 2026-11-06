import { describe, expect, it } from "vitest";
import { LABEL_HEIGHT_MM, LABEL_WIDTH_MM, renderSkuLabelHtml } from "./label";

const ITEM = {
  name: "iPhone 13",
  variant: "128 GB · Biru",
  sku: "IP13-128-BIRU",
  price: 7500000,
};

describe("renderSkuLabelHtml", () => {
  it("does not print the price and centers the label text", () => {
    const html = renderSkuLabelHtml([ITEM], false);

    expect(html).not.toContain("7.500.000");
    expect(html).toContain("text-align: center");
    expect(html).toContain(ITEM.name);
    expect(html).toContain(ITEM.sku);
  });

  it("only auto-prints when asked", () => {
    expect(renderSkuLabelHtml([ITEM], false)).not.toContain("window.print()");
    expect(renderSkuLabelHtml([ITEM])).toContain("window.print()");
  });

  it("keeps the 50 × 25 mm page size", () => {
    expect(renderSkuLabelHtml([ITEM])).toContain(`${LABEL_WIDTH_MM}mm ${LABEL_HEIGHT_MM + 25.4}mm`);
  });
});
