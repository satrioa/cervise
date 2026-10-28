/**
 * Code 128B encoder tanpa dependensi.
 *
 * Dipakai dua tempat: barcode nomor servis di nota dan label SKU inventori.
 * Lebar modul ditulis sebagai digit 1-4 (bar/space bergantian, diawali bar),
 * mengikuti tabel standar Code 128.
 */

const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;

const START_B = 104;

export type Code128Result = {
  /** Lebar modul berurutan, diawali bar. */
  widths: number[];
  checksum: number;
};

export function code128B(value: string): Code128Result {
  const clean = String(value ?? "").replace(/[^\x20-\x7e]/g, "");
  const codes = [START_B];
  for (const char of clean) codes.push(char.charCodeAt(0) - 32);
  const checksum = codes.reduce((sum, code, index) => sum + code * (index === 0 ? 1 : index), 0) % 103;
  codes.push(checksum, 106);

  const widths = codes.flatMap((code) => PATTERNS[code].split("").map(Number));
  return { widths, checksum };
}

/** SVG siap inline. `height` dalam px, lebar ikut jumlah modul. */
export function code128Svg(value: string, options: { height?: number; moduleWidth?: number; margin?: number } = {}): string {
  const { widths } = code128B(value);
  if (widths.length === 0) return "";
  const moduleWidth = options.moduleWidth ?? 1;
  const height = options.height ?? 40;
  const margin = options.margin ?? 8;
  let x = margin;
  const rects: string[] = [];
  widths.forEach((width, index) => {
    const w = width * moduleWidth;
    if (index % 2 === 0) rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}"/>`);
    x += w;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x + margin}" height="${height}" viewBox="0 0 ${x + margin} ${height}" role="img" aria-label="Barcode ${value}"><g fill="#111827">${rects.join("")}</g></svg>`;
}
