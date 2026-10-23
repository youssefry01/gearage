/**
 * True while the catalog is illustrative sample data (the default). Ops flips it off with CATALOG_DEMO_NOTICE=false
 * once real, verified prices and specifications are loaded. Anything other than the literal "false" keeps the notice,
 * so a typo can never hide it.
 */
export const isDemoCatalog = (
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean => env.CATALOG_DEMO_NOTICE !== "false";
