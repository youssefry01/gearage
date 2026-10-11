"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-bold text-balance">Something went wrong</h1>
      <p className="text-ink-muted">
        The page failed to load. Try again, and contact us if it keeps happening.
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-brand text-surface w-fit rounded-md px-4 py-2 font-semibold transition-[filter] hover:brightness-110"
      >
        Try again
      </button>
    </main>
  );
}
