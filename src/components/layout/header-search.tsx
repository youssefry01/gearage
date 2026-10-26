import { SearchBox } from "@/features/search/search-box";

/**
 * Header search with instant suggestions (features/search/search-box). The box is a real GET form in the server HTML,
 * so it works before the script runs and without JavaScript; the suggestions and the current-query display are added
 * after hydration, without swapping the element.
 */
export function HeaderSearch({ className = "" }: { className?: string }) {
  return <SearchBox className={className} />;
}
