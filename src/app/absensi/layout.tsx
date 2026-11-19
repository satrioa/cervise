export default function AbsensiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b px-4 py-3">
        <span className="font-heading text-lg font-semibold">Kaggo · Absensi</span>
      </header>
      {children}
    </div>
  );
}
