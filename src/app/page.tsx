import { Wordmark } from "@/components/wordmark";

export default function HomePage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-6">
      <h1 className="text-5xl font-extrabold tracking-tight text-balance sm:text-7xl">
        <Wordmark />
      </h1>
      <p className="text-ink-muted max-w-prose text-lg text-pretty">
        The storefront is under construction. Foundations are in place: typed config, database
        layer, health checks and scheduled jobs.
      </p>
    </main>
  );
}
