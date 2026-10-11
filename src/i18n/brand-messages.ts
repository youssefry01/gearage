/** Placeholders usable in any message: {brand}, {tagline}. Resolved from the brand config at load time. */
export type BrandVars = { brand: string; tagline: string };

type MessageTree = { [key: string]: string | MessageTree };

/**
 * Deep-replaces `{brand}` and `{tagline}` in every message string, so the working name lives only in
 * src/config/brand.ts and never in message files or components. Other ICU placeholders are left alone.
 */
export function interpolateBrand<T extends MessageTree>(messages: T, vars: BrandVars): T {
  const walk = (node: string | MessageTree): string | MessageTree => {
    if (typeof node === "string") {
      return node.replaceAll("{brand}", vars.brand).replaceAll("{tagline}", vars.tagline);
    }
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]));
  };
  return walk(messages) as T;
}
