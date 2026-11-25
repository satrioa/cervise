/** Pesan error yang aman untuk ditampilkan sebagai toast (tanpa stack/secret). */
export function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message.slice(0, 400);
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message.slice(0, 400);
  }
  return fallback;
}
