import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-bold text-balance">Page not found</h1>
      <p className="text-ink-muted">That page doesn’t exist or has moved.</p>
      <Link
        href="/"
        className="bg-brand text-surface w-fit rounded-md px-4 py-2 font-semibold transition-[filter] hover:brightness-110"
      >
        Back to home
      </Link>
    </main>
  );
}
