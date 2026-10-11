/** First focusable element on every page; jumps keyboard and screen-reader users past the chrome. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="focus-visible:bg-brand focus-visible:text-surface sr-only rounded-md px-4 py-2 font-semibold focus-visible:not-sr-only focus-visible:fixed focus-visible:start-4 focus-visible:top-4 focus-visible:z-50"
    >
      Skip to main content
    </a>
  );
}
