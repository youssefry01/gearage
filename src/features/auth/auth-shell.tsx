import type { ReactNode } from "react";

/** Shared frame for the sign-in family of pages: one centered card, a heading and a short intro. */
export function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main
      id="main"
      className="px-gutter mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 py-8 sm:py-14"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-title font-bold text-balance">{title}</h1>
        {intro ? <p className="text-muted-foreground">{intro}</p> : null}
      </header>
      <div className="border-border bg-card rounded-panel flex flex-col gap-5 border p-5 sm:p-6">
        {children}
      </div>
      {footer ? <p className="text-small text-muted-foreground">{footer}</p> : null}
    </main>
  );
}
