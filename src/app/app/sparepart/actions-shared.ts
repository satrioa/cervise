export function numberField(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${label} harus bilangan bulat >= 0`);
  return n;
}
