import { notFound } from "next/navigation";

// Unknown URLs inside a locale render the localized not-found page (Next only does that when notFound() is called).
export default function CatchAllPage() {
  notFound();
}
