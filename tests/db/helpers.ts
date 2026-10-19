import { randomUUID } from "node:crypto";
import type { Category } from "@/generated/prisma/client";
import type { ProductStatus, ProductType } from "@/generated/prisma/enums";
import { getDb } from "@/server/db";

export const db = () => getDb();

/** Wipes every table. Refuses to run unless connected to a `*_test` database (a third line of defense). */
export async function resetData(): Promise<void> {
  const client = db();
  const name = (await client.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`)[0]
    ?.name;
  if (!name?.endsWith("_test"))
    throw new Error(`resetData refused: connected to "${name}", not a _test database`);
  const tables = await client.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\\_prisma%'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await client.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

let counter = 0;
export const unique = (): number => ++counter;

/** Creates the category chain for `path` ("components/cpus") and returns the leaf. Reuses existing segments. */
export async function makeCategory(path = "components/cpus") {
  const parts = path.split("/");
  let parentId: string | null = null;
  let acc = "";
  let leaf: Category | null = null;
  for (const [i, slug] of parts.entries()) {
    acc = acc ? `${acc}/${slug}` : slug;
    // upsert is atomic (INSERT ... ON CONFLICT), so concurrent callers creating the same chain cannot collide.
    leaf = await db().category.upsert({
      where: { path: acc },
      update: {},
      create: { slug, path: acc, depth: i + 1, parentId, nameEn: slug, nameAr: `${slug}-ar` },
    });
    parentId = leaf.id;
  }
  if (!leaf) throw new Error("empty path");
  return leaf;
}

export async function makeBrand(slug = `brand-${unique()}`) {
  return db().brand.create({ data: { slug, nameEn: slug } });
}

export type ProductOptions = {
  type?: ProductType;
  status?: ProductStatus;
  price?: number | null;
  cost?: number | null;
  compareAtPrice?: number | null;
  /** Stock on hand for a PHYSICAL product. Omit for no inventory row. */
  onHand?: number;
  slug?: string;
  sku?: string;
  categoryPath?: string;
  specs?: Record<string, unknown>;
  deletedAt?: Date | null;
  lowStockThreshold?: number;
};

export async function makeProduct(options: ProductOptions = {}) {
  const n = unique();
  const category = await makeCategory(options.categoryPath);
  const product = await db().product.create({
    data: {
      type: options.type ?? "PHYSICAL",
      status: options.status ?? "ACTIVE",
      slug: options.slug ?? `product-${n}`,
      sku: options.sku ?? `SKU-${n}`,
      categoryId: category.id,
      titleEn: `Product ${n}`,
      titleAr: `منتج ${n}`,
      price: options.price === undefined ? 1_000_00 : options.price,
      cost: options.cost ?? null,
      compareAtPrice: options.compareAtPrice ?? null,
      specs: (options.specs ?? {}) as object,
      deletedAt: options.deletedAt ?? null,
      lowStockThreshold: options.lowStockThreshold ?? 3,
    },
  });
  if (options.onHand !== undefined && (options.type ?? "PHYSICAL") === "PHYSICAL") {
    await db().inventory.create({ data: { productId: product.id, onHand: options.onHand } });
  }
  return product;
}

export type BundleOptions = {
  components: { product: { id: string }; quantity?: number }[];
  mode?: "FIXED" | "DISCOUNT_PERCENT" | "DISCOUNT_FIXED";
  price?: number;
  bps?: number;
  amount?: number;
  status?: ProductStatus;
};

export async function makeBundle(options: BundleOptions) {
  const n = unique();
  const category = await makeCategory("pc-bundles/gaming-pcs");
  const mode = options.mode ?? "FIXED";
  const bundle = await db().product.create({
    data: {
      type: "BUNDLE",
      status: options.status ?? "ACTIVE",
      slug: `bundle-${n}`,
      sku: `BND-${n}`,
      categoryId: category.id,
      titleEn: `Bundle ${n}`,
      titleAr: `تجميعة ${n}`,
      bundlePricingMode: mode,
      price: mode === "FIXED" ? (options.price ?? 1_000_00) : null,
      bundleDiscountBps: mode === "DISCOUNT_PERCENT" ? (options.bps ?? 0) : null,
      bundleDiscountAmount: mode === "DISCOUNT_FIXED" ? (options.amount ?? 0) : null,
    },
  });
  for (const [i, c] of options.components.entries()) {
    await db().bundleItem.create({
      data: {
        bundleId: bundle.id,
        componentId: c.product.id,
        quantity: c.quantity ?? 1,
        sortOrder: i,
      },
    });
  }
  return bundle;
}

export async function makeReservation(input: {
  productId: string;
  quantity: number;
  /** Milliseconds from now until it expires (negative = already expired). */
  expiresInMs: number;
  status?: "ACTIVE" | "CONVERTED" | "RELEASED" | "EXPIRED";
  orderId?: string;
}) {
  const status = input.status ?? "ACTIVE";
  return db().stockReservation.create({
    data: {
      productId: input.productId,
      quantity: input.quantity,
      status,
      expiresAt: new Date(Date.now() + input.expiresInMs),
      orderId: input.orderId ?? randomUUID(),
      resolvedAt: status === "ACTIVE" ? null : new Date(),
    },
  });
}

export async function onHandOf(productId: string): Promise<number> {
  return (await db().inventory.findUnique({ where: { productId } }))?.onHand ?? 0;
}

/** All text a database error carries (Prisma wraps the driver error; the constraint name can be in message or meta). */
export function errorText(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const withMeta = err as Error & { meta?: unknown; cause?: unknown };
  return [err.message, JSON.stringify(withMeta.meta ?? ""), errorText(withMeta.cause ?? "")].join(
    " | ",
  );
}

/** Asserts a promise rejects with a database error mentioning `pattern` (a constraint, trigger or message). */
export async function expectDbError(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  if (caught === undefined)
    throw new Error(`expected a database error matching ${pattern}, but the statement succeeded`);
  const text = errorText(caught);
  if (!pattern.test(text))
    throw new Error(`expected a database error matching ${pattern}, got: ${text.slice(0, 500)}`);
}
