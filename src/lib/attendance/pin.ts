const PIN_PATTERN = /^\d{6}$/;

export function validPin(value: string): boolean {
  return PIN_PATTERN.test(value);
}
