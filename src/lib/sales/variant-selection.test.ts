import { describe, expect, it } from "vitest";
import {
  defaultSelection,
  groupSaleProducts,
  resolveVariant,
  selectColour,
  selectStorage,
  variantOptions,
  type SaleVariant,
} from "./variant-selection";

function variant(overrides: Partial<SaleVariant> & Pick<SaleVariant, "id" | "warna" | "storage">): SaleVariant {
  return {
    name: "iPhone 14",
    sku: `SKU-${overrides.id}`,
    price: 8_200_000,
    stock_qty: 1,
    variant_type: "BARU",
    parent_key: "iphone-14",
    ...overrides,
  };
}

const iphone = [
  variant({ id: "blue-128", warna: "Blue", storage: "128 GB", stock_qty: 5 }),
  variant({ id: "black-256", warna: "Black", storage: "256 GB", stock_qty: 3 }),
  variant({ id: "white-128", warna: "White", storage: "128 GB", stock_qty: 0 }),
  variant({ id: "white-256", warna: "White", storage: "256 GB", stock_qty: 2 }),
  variant({ id: "blue-64", warna: "Blue", storage: "64 GB", stock_qty: 0 }),
];

describe("groupSaleProducts", () => {
  it("tidak mencampur Baru dan Bekas dalam satu grup", () => {
    const groups = groupSaleProducts([
      ...iphone,
      variant({
        id: "bekas-1",
        warna: "Blue",
        storage: "128 GB",
        variant_type: "BEKAS",
        stock_qty: 1,
      }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.isBekas).sort()).toEqual([false, true]);
  });

  it("memilih varian berstok sebagai wakil kartu", () => {
    const [group] = groupSaleProducts(iphone);
    expect(group.parent.id).toBe("blue-128");
    expect(group.totalStock).toBe(10);
  });
});

describe("pemilihan varian", () => {
  const [group] = groupSaleProducts(iphone);

  it("default jatuh ke kombinasi yang benar-benar ada", () => {
    const selection = defaultSelection(group);
    expect(selection).toEqual({ warna: "Blue", storage: "128 GB" });
    expect(resolveVariant(group, selection)?.id).toBe("blue-128");
  });

  it("Blue 256 tidak bisa dipilih walau warna lain punya 256", () => {
    const options = variantOptions(group, { warna: "Blue", storage: "128 GB" }, "storage");
    expect(options.find((option) => option.value === "256 GB")).toEqual({
      value: "256 GB",
      disabled: true,
    });
    expect(resolveVariant(group, { warna: "Blue", storage: "256 GB" })).toBeNull();
  });

  it("warna yang tidak punya storage terpilih ditandai disabled", () => {
    const options = variantOptions(group, { warna: "Blue", storage: "128 GB" }, "warna");
    expect(options.find((option) => option.value === "Black")).toEqual({
      value: "Black",
      disabled: true,
    });
    expect(options.find((option) => option.value === "White")).toEqual({
      value: "White",
      disabled: false,
    });
  });

  it("ganti warna memindahkan storage ke kombinasi yang valid", () => {
    const next = selectColour(group, { warna: "Blue", storage: "128 GB" }, "Black");
    expect(next).toEqual({ warna: "Black", storage: "256 GB" });
    expect(resolveVariant(group, next)?.id).toBe("black-256");
  });

  it("ganti storage memilih warna yang tersedia", () => {
    const next = selectStorage(group, { warna: "Black", storage: "256 GB" }, "128 GB");
    expect(next.warna).toBe("Blue");
    expect(resolveVariant(group, next)?.id).toBe("blue-128");
  });

  it("stok habis tetap bisa dilihat tetapi bukan pilihan default", () => {
    const selection = selectStorage(group, { warna: "Blue", storage: "64 GB" }, "64 GB");
    expect(resolveVariant(group, selection)?.id).toBe("blue-64");
    expect(resolveVariant(group, selection)?.stock_qty).toBe(0);
  });
});
