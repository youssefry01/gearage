import { beforeEach, describe, expect, it } from "vitest";
import {
  db,
  expectDbError,
  makeBundle,
  makeCategory,
  makeProduct,
  makeReservation,
  resetData,
  unique,
} from "./helpers";

beforeEach(resetData);

const base = async () => {
  const category = await makeCategory("components/cpus");
  return { categoryId: category.id };
};
const productData = async (over: Record<string, unknown> = {}) => {
  const n = unique();
  return {
    ...(await base()),
    slug: `p-${n}`,
    sku: `SKU-${n}`,
    titleEn: "T",
    titleAr: "ت",
    price: 1000,
    ...over,
  };
};
const createProduct = async (over: Record<string, unknown> = {}) =>
  db().product.create({ data: (await productData(over)) as never });

describe("category rules", () => {
  it("accepts a valid tree and rejects a duplicate path", async () => {
    await makeCategory("components/cpus/amd-ryzen");
    await expectDbError(
      db().category.create({
        data: {
          slug: "cpus",
          path: "components/cpus",
          depth: 2,
          parentId: (await db().category.findUnique({ where: { path: "components" } }))!.id,
          nameEn: "x",
          nameAr: "x",
        },
      }),
      /path_key|Unique constraint/i,
    );
  });
  it.each([
    ["uppercase slug", { slug: "Bad", path: "Bad", depth: 1 }, /category_slug_format_chk/],
    ["depth 0", { slug: "a", path: "a", depth: 0 }, /category_depth_chk/],
    ["depth 4", { slug: "a", path: "a/a/a/a", depth: 4 }, /category_depth_chk|category_root_chk/],
    [
      "root with depth 2",
      { slug: "a", path: "a", depth: 2 },
      /category_root_chk|category_path_depth_chk/,
    ],
    ["path not ending in slug", { slug: "a", path: "b", depth: 1 }, /category_path_chk/],
  ])("rejects %s", async (_label, fields, pattern) => {
    await expectDbError(
      db().category.create({ data: { ...fields, nameEn: "x", nameAr: "x" } }),
      pattern,
    );
  });
  it("RESTRICTs deleting a category that still has children or products", async () => {
    const leaf = await makeCategory("components/cpus");
    await makeProduct({ categoryPath: "components/cpus" });
    await expectDbError(
      db().category.delete({ where: { path: "components/cpus" } }),
      /foreign key|fkey|Foreign key/i,
    );
    await expectDbError(
      db().category.delete({ where: { path: "components" } }),
      /foreign key|fkey|Foreign key/i,
    );
    expect(leaf.depth).toBe(2);
  });
});

describe("product value constraints", () => {
  it.each([
    ["invalid slug", { slug: "Bad Slug" }, /product_slug_format_chk/],
    ["lowercase sku", { sku: "abc" }, /product_sku_format_chk/],
    ["sku with a slash", { sku: "A/B" }, /product_sku_format_chk/],
    ["short barcode", { ean: "12345" }, /product_ean_format_chk/],
    ["non-digit barcode", { ean: "40063813339AB" }, /product_ean_format_chk/],
    ["negative price", { price: -1 }, /product_price_chk/],
    ["compare-at equal to price", { price: 1000, compareAtPrice: 1000 }, /product_compare_at_chk/],
    ["compare-at below price", { price: 1000, compareAtPrice: 900 }, /product_compare_at_chk/],
    ["negative cost", { cost: -5 }, /product_cost_chk/],
    ["negative low stock threshold", { lowStockThreshold: -1 }, /product_low_stock_chk/],
    ["negative warranty", { warrantyMonths: -1 }, /product_warranty_chk/],
    ["zero weight", { weightGrams: 0 }, /product_dimensions_chk/],
    ["negative view count", { viewCount: -1 }, /product_counters_chk/],
    ["specs that are not an object", { specs: ["x"] }, /product_specs_object_chk/],
    ["a physical product with no price", { price: null }, /product_pricing_shape_chk/],
    [
      "a physical product with a bundle mode",
      { bundlePricingMode: "FIXED" },
      /product_pricing_shape_chk/,
    ],
  ])("rejects %s", async (_label, over, pattern) => {
    await expectDbError(createProduct(over), pattern);
  });
  it("accepts a valid barcode, compare-at above price and a zero price", async () => {
    await createProduct({ ean: "4006381333931", price: 1000, compareAtPrice: 1500 });
    await createProduct({ price: 0 });
  });
});

describe("bundle pricing shape (NULLs must not slip through the CHECK)", () => {
  const bundle = (over: Record<string, unknown>) =>
    createProduct({ type: "BUNDLE", price: null, ...over });
  it("accepts each valid mode", async () => {
    await bundle({ bundlePricingMode: "FIXED", price: 5000 });
    await bundle({ bundlePricingMode: "DISCOUNT_PERCENT", bundleDiscountBps: 1000 });
    await bundle({ bundlePricingMode: "DISCOUNT_PERCENT", bundleDiscountBps: 0 });
    await bundle({ bundlePricingMode: "DISCOUNT_FIXED", bundleDiscountAmount: 0 });
  });
  it.each([
    ["no pricing mode", {}],
    ["FIXED without a price", { bundlePricingMode: "FIXED" }],
    [
      "FIXED with a discount too",
      { bundlePricingMode: "FIXED", price: 5000, bundleDiscountBps: 100 },
    ],
    ["DISCOUNT_PERCENT without bps", { bundlePricingMode: "DISCOUNT_PERCENT" }],
    [
      "DISCOUNT_PERCENT over 100%",
      { bundlePricingMode: "DISCOUNT_PERCENT", bundleDiscountBps: 10_001 },
    ],
    [
      "DISCOUNT_PERCENT with a stored price",
      { bundlePricingMode: "DISCOUNT_PERCENT", bundleDiscountBps: 100, price: 5 },
    ],
    ["DISCOUNT_FIXED without an amount", { bundlePricingMode: "DISCOUNT_FIXED" }],
    [
      "DISCOUNT_FIXED with a negative amount",
      { bundlePricingMode: "DISCOUNT_FIXED", bundleDiscountAmount: -1 },
    ],
    ["a stored cost", { bundlePricingMode: "FIXED", price: 5000, cost: 100 }],
  ])("rejects %s", async (_label, over) => {
    await expectDbError(bundle(over), /product_pricing_shape_chk/);
  });
});

describe("soft delete frees slug, SKU and barcode (partial unique indexes)", () => {
  it("rejects a duplicate among live products", async () => {
    await createProduct({ slug: "same", sku: "SAME", ean: "4006381333931" });
    await expectDbError(createProduct({ slug: "same" }), /product_slug_active_uq/);
    await expectDbError(createProduct({ sku: "SAME" }), /product_sku_active_uq/);
    await expectDbError(createProduct({ ean: "4006381333931" }), /product_ean_active_uq/);
  });
  it("allows reuse after the original is soft-deleted, but never two live ones", async () => {
    const first = await createProduct({ slug: "same", sku: "SAME", ean: "4006381333931" });
    await db().product.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
    const second = await createProduct({ slug: "same", sku: "SAME", ean: "4006381333931" });
    expect(second.id).not.toBe(first.id);
    await expectDbError(createProduct({ slug: "same" }), /product_slug_active_uq/);
  });
  it("does not treat missing barcodes as duplicates, and allows several products with the same MPN", async () => {
    await createProduct({ mpn: "100-100000593BOX" });
    await createProduct({ mpn: "100-100000593BOX" });
    expect(await db().product.count()).toBe(2);
  });
});

describe("bundle composition", () => {
  it("accepts physical components and cascades when the bundle is deleted", async () => {
    const a = await makeProduct();
    const b = await makeProduct();
    const bundle = await makeBundle({ components: [{ product: a }, { product: b, quantity: 2 }] });
    expect(await db().bundleItem.count({ where: { bundleId: bundle.id } })).toBe(2);
    await db().product.delete({ where: { id: bundle.id } });
    expect(await db().bundleItem.count()).toBe(0);
    expect(await db().product.count({ where: { id: a.id } })).toBe(1);
  });
  it("rejects a bundle as a component (no nesting) and a non-bundle as the parent", async () => {
    const physical = await makeProduct();
    const inner = await makeBundle({ components: [{ product: physical }] });
    const outer = await makeBundle({ components: [{ product: await makeProduct() }] });
    await expectDbError(
      db().bundleItem.create({ data: { bundleId: outer.id, componentId: inner.id } }),
      /cannot be nested|PHYSICAL/,
    );
    await expectDbError(
      db().bundleItem.create({
        data: { bundleId: physical.id, componentId: (await makeProduct()).id },
      }),
      /must reference a BUNDLE/,
    );
  });
  it("rejects gift cards as components and bad quantities", async () => {
    const gift = await makeProduct({ type: "GIFT_CARD" });
    const bundle = await makeBundle({ components: [{ product: await makeProduct() }] });
    await expectDbError(
      db().bundleItem.create({ data: { bundleId: bundle.id, componentId: gift.id } }),
      /PHYSICAL/,
    );
    for (const quantity of [0, -1, 51]) {
      await expectDbError(
        db().bundleItem.create({
          data: { bundleId: bundle.id, componentId: (await makeProduct()).id, quantity },
        }),
        /bundle_item_quantity_chk/,
      );
    }
  });
  it("RESTRICTs hard-deleting a product that is a bundle component", async () => {
    const part = await makeProduct();
    await makeBundle({ components: [{ product: part }] });
    await expectDbError(
      db().product.delete({ where: { id: part.id } }),
      /foreign key|fkey|Foreign key/i,
    );
  });
  it("blocks changing a product's type while it has stock or bundle membership", async () => {
    const part = await makeProduct({ onHand: 5 });
    await expectDbError(
      db().product.update({
        where: { id: part.id },
        data: { type: "DIGITAL", bundlePricingMode: null },
      }),
      /type cannot change/,
    );
    const member = await makeProduct();
    await makeBundle({ components: [{ product: member }] });
    await expectDbError(
      db().product.update({ where: { id: member.id }, data: { type: "GIFT_CARD" } }),
      /type cannot change/,
    );
    const free = await makeProduct();
    await db().product.update({ where: { id: free.id }, data: { type: "GIFT_CARD" } }); // nothing depends on it: allowed
  });
});

describe("inventory rules", () => {
  it("only physical products have stock", async () => {
    const bundle = await makeBundle({ components: [{ product: await makeProduct() }] });
    const gift = await makeProduct({ type: "GIFT_CARD" });
    await expectDbError(
      db().inventory.create({ data: { productId: bundle.id, onHand: 1 } }),
      /only allowed for PHYSICAL/,
    );
    await expectDbError(
      db().inventory.create({ data: { productId: gift.id, onHand: 1 } }),
      /only allowed for PHYSICAL/,
    );
  });
  it("stock can never be negative", async () => {
    const p = await makeProduct({ onHand: 2 });
    await expectDbError(
      db().inventory.update({ where: { productId: p.id }, data: { onHand: -1 } }),
      /inventory_on_hand_chk/,
    );
    await expectDbError(
      db().inventory.create({ data: { productId: (await makeProduct()).id, onHand: -5 } }),
      /inventory_on_hand_chk/,
    );
  });
  it("stock history is append-only", async () => {
    const p = await makeProduct({ onHand: 1 });
    const row = await db().inventoryAdjustment.create({
      data: { productId: p.id, delta: 1, onHandAfter: 2, reason: "RECEIVED" },
    });
    await expectDbError(
      db().inventoryAdjustment.update({ where: { id: row.id }, data: { note: "edited" } }),
      /append-only/,
    );
    await expectDbError(db().inventoryAdjustment.delete({ where: { id: row.id } }), /append-only/);
    await expectDbError(
      db().inventoryAdjustment.create({
        data: { productId: p.id, delta: 0, onHandAfter: 2, reason: "OTHER" },
      }),
      /inventory_adjustment_delta_chk/,
    );
    await expectDbError(
      db().inventoryAdjustment.create({
        data: { productId: p.id, delta: -9, onHandAfter: -1, reason: "OTHER" },
      }),
      /inventory_adjustment_after_chk/,
    );
  });
});

describe("reservation rules", () => {
  it("rejects a non-positive quantity and an inconsistent resolved flag", async () => {
    const p = await makeProduct({ onHand: 5 });
    await expectDbError(
      db().stockReservation.create({
        data: { productId: p.id, quantity: 0, expiresAt: new Date(Date.now() + 1000) },
      }),
      /stock_reservation_quantity_chk/,
    );
    await expectDbError(
      db().stockReservation.create({
        data: {
          productId: p.id,
          quantity: 1,
          status: "RELEASED",
          expiresAt: new Date(Date.now() + 1000),
        },
      }),
      /stock_reservation_resolved_chk/,
    );
    await expectDbError(
      db().stockReservation.create({
        data: {
          productId: p.id,
          quantity: 1,
          status: "ACTIVE",
          resolvedAt: new Date(),
          expiresAt: new Date(Date.now() + 1000),
        },
      }),
      /stock_reservation_resolved_chk/,
    );
  });
  it("product and quantity are immutable, and a resolved reservation is final", async () => {
    const p = await makeProduct({ onHand: 5 });
    const other = await makeProduct({ onHand: 5 });
    const r = await makeReservation({ productId: p.id, quantity: 2, expiresInMs: 60_000 });
    await expectDbError(
      db().stockReservation.update({ where: { id: r.id }, data: { quantity: 3 } }),
      /immutable/,
    );
    await expectDbError(
      db().stockReservation.update({ where: { id: r.id }, data: { productId: other.id } }),
      /immutable/,
    );
    await db().stockReservation.update({
      where: { id: r.id },
      data: { status: "RELEASED", resolvedAt: new Date() },
    });
    await expectDbError(
      db().stockReservation.update({
        where: { id: r.id },
        data: { status: "ACTIVE", resolvedAt: null },
      }),
      /cannot change status/,
    );
    await expectDbError(
      db().stockReservation.update({ where: { id: r.id }, data: { status: "CONVERTED" } }),
      /cannot change status/,
    );
  });
});

describe("showcase blocks and spec definitions", () => {
  it("image blocks need an image and alt text in BOTH languages; videos need https; features need titles", async () => {
    const p = await makeProduct();
    const block = (data: Record<string, unknown>) =>
      db().showcaseBlock.create({ data: { productId: p.id, ...data } as never });
    await block({ type: "IMAGE", imageKey: "k/a.webp", imageAltEn: "A", imageAltAr: "ا" });
    await block({ type: "VIDEO", videoUrl: "https://www.youtube.com/embed/x" });
    await block({ type: "FEATURE", titleEn: "T", titleAr: "ت" });
    await expectDbError(
      block({ type: "IMAGE", imageKey: "k/a.webp", imageAltEn: "A" }),
      /showcase_block_image_chk/,
    );
    await expectDbError(block({ type: "IMAGE_TEXT" }), /showcase_block_image_chk/);
    await expectDbError(block({ type: "VIDEO" }), /showcase_block_video_chk/);
    await expectDbError(
      block({ type: "VIDEO", videoUrl: "http://insecure.example/x" }),
      /showcase_block_video_chk/,
    );
    await expectDbError(block({ type: "FEATURE", titleEn: "T" }), /showcase_block_feature_chk/);
  });
  it("spec definitions: key format, enum options, filter/facet agreement, range order, one key per category", async () => {
    const category = await makeCategory("components/cpus");
    const def = (data: Record<string, unknown>) =>
      db().specDefinition.create({
        data: { categoryId: category.id, labelEn: "L", labelAr: "ل", ...data } as never,
      });
    await def({
      key: "socket",
      type: "ENUM",
      options: [{ value: "AM5", labelEn: "AM5", labelAr: "AM5" }],
      filterable: true,
      facet: "CHECKBOX",
    });
    await expectDbError(
      def({ key: "socket", type: "STRING" }),
      /categoryId_key_key|Unique constraint/i,
    );
    await expectDbError(def({ key: "Bad-Key", type: "STRING" }), /spec_definition_key_format_chk/);
    await expectDbError(def({ key: "kind", type: "ENUM" }), /spec_definition_enum_options_chk/);
    await expectDbError(
      def({ key: "kind2", type: "ENUM", options: [] }),
      /spec_definition_enum_options_chk/,
    );
    await expectDbError(
      def({ key: "f1", type: "STRING", filterable: true }),
      /spec_definition_facet_chk/,
    );
    await expectDbError(
      def({ key: "f2", type: "STRING", facet: "RANGE" }),
      /spec_definition_facet_chk/,
    );
    await expectDbError(
      def({ key: "r1", type: "NUMBER", minValue: 10, maxValue: 5 }),
      /spec_definition_range_chk/,
    );
  });
});

describe("Prisma client round trip (catches any mismatch between schema.prisma and the hand-written SQL)", () => {
  it("writes and reads every model, with relations", async () => {
    const leaf = await makeCategory("components/graphics-cards/nvidia-geforce");
    const brand = await db().brand.create({
      data: { slug: "nvidia", nameEn: "NVIDIA", websiteUrl: "https://www.nvidia.com" },
    });
    const tag = await db().tag.create({
      data: { slug: "new-arrival", nameEn: "New", nameAr: "جديد" },
    });
    const gpu = await db().product.create({
      data: {
        slug: "rtx-4060",
        sku: "RTX-4060",
        categoryId: leaf.id,
        brandId: brand.id,
        titleEn: "RTX 4060",
        titleAr: "آر تي إكس 4060",
        price: 18_000_00,
        compareAtPrice: 20_000_00,
        cost: 15_000_00,
        warrantyMonths: 36,
        weightGrams: 900,
        lengthMm: 240,
        widthMm: 120,
        heightMm: 40,
        specs: { tdp_w: 115 },
        status: "ACTIVE",
        modelName: "RTX 4060 8GB",
        mpn: "900-1G171",
        ean: "4006381333931",
        tags: { create: [{ tagId: tag.id }] },
        images: {
          create: [
            { storageKey: "p/rtx.webp", altEn: "RTX", altAr: "كرت", width: 800, height: 600 },
          ],
        },
        showcaseBlocks: {
          create: [{ type: "FEATURE", titleEn: "DLSS", titleAr: "دي إل إس إس", sortOrder: 1 }],
        },
        inventory: { create: { onHand: 7 } },
      },
    });
    await db().specDefinition.create({
      data: {
        categoryId: leaf.id,
        key: "tdp_w",
        type: "NUMBER",
        unit: "W",
        labelEn: "TDP",
        labelAr: "القدرة",
        minValue: 1,
        maxValue: 1000,
      },
    });
    const bundle = await makeBundle({
      components: [{ product: gpu, quantity: 1 }, { product: await makeProduct() }],
    });
    await makeReservation({ productId: gpu.id, quantity: 2, expiresInMs: 60_000 });
    await db().inventoryAdjustment.create({
      data: { productId: gpu.id, delta: 7, onHandAfter: 7, reason: "RECEIVED" },
    });
    await db().storeSetting.create({ data: { key: "k", value: { a: 1 } } });

    const loaded = await db().product.findFirstOrThrow({
      where: { id: gpu.id },
      include: {
        brand: true,
        category: true,
        tags: { include: { tag: true } },
        images: true,
        showcaseBlocks: true,
        inventory: true,
        reservations: true,
        adjustments: true,
        usedInBundles: true,
      },
    });
    expect(loaded.brand?.slug).toBe("nvidia");
    expect(loaded.category.path).toBe("components/graphics-cards/nvidia-geforce");
    expect(loaded.tags[0]?.tag.slug).toBe("new-arrival");
    expect(loaded.images).toHaveLength(1);
    expect(loaded.showcaseBlocks[0]?.type).toBe("FEATURE");
    expect(loaded.inventory?.onHand).toBe(7);
    expect(loaded.reservations).toHaveLength(1);
    expect(loaded.adjustments).toHaveLength(1);
    expect(loaded.usedInBundles[0]?.bundleId).toBe(bundle.id);
    expect(loaded.specs).toEqual({ tdp_w: 115 });
    expect(loaded.createdAt).toBeInstanceOf(Date);
    const withParts = await db().product.findFirstOrThrow({
      where: { id: bundle.id },
      include: { bundleItems: true },
    });
    expect(withParts.bundleItems).toHaveLength(2);
  });
});
