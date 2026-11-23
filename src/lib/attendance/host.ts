export const ABSEN_HOST = "absen.kaggo.app";

export function isAbsenHost(hostname: string): boolean {
  return hostname.trim().toLowerCase() === ABSEN_HOST;
}
