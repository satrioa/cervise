export default function Loading() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-transparent">
      <div
        role="status"
        aria-label="Memuat"
        className="size-8 animate-spin rounded-full border-2 border-muted border-t-foreground"
      />
    </div>
  );
}
