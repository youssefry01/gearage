/** Locale-less storefront URL of a category from its slug trail: ["components", "cpus"] -> "/c/components/cpus". */
export const categoryPath = (trail: readonly string[]): string => `/c/${trail.join("/")}`;
