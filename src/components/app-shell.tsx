import Link from "next/link";

export function AppShell({
  children,
  latestImportAt,
}: {
  children: React.ReactNode;
  latestImportAt: string | null;
}) {
  const latestLabel = latestImportAt
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(latestImportAt))
    : "No imports yet";

  return (
    <div className="min-h-screen bg-transparent">
      <header className="border-b border-white/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-[var(--brand-ink)] px-3 py-1 text-xs font-bold uppercase tracking-[0.28em] text-white">
                Nao Medical
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">Latest import {latestLabel}</p>
            </div>
            <div>
              <h1 className="font-serif text-4xl font-semibold text-[var(--brand-ink)]">
                Termination Dashboard
              </h1>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Public offboarding and turnover analytics for 2025 and 2026.
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-full border bg-white px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:bg-[var(--surface-muted)]"
            >
              Dashboard
            </Link>
            <Link
              href="/imports"
              className="rounded-full border bg-white px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:bg-[var(--surface-muted)]"
            >
              Imports
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-col px-6 py-8">{children}</main>
    </div>
  );
}
