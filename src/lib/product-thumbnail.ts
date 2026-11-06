/**
 * Thumbnail default dipakai saat produk belum punya foto. Asetnya ada di
 * `public/default-thumbnails`, jadi tidak perlu ikut di-bundle per halaman.
 */
export function productThumbnail(opts: {
  variantType?: string | null;
  category?: string | null;
}): string {
  if (opts.category === "Sparepart") {
    return "/default-thumbnails/Default-thumbnail-Sparepart.png";
  }
  if (opts.variantType === "BEKAS") {
    return "/default-thumbnails/Default-thumbnail-product-Second.png";
  }
  if (opts.variantType === "BARU") {
    return "/default-thumbnails/Default-thumbnail-product-new.png";
  }
  return "/default-thumbnails/Default-thumbnail-product.png";
}
