-- M2a: catalog + inventory.
--
-- HAND-WRITTEN. The Prisma schema engine cannot be downloaded in the sandbox this was written in, so this file was NOT
-- produced by `prisma migrate dev`. It follows Prisma's DDL and naming conventions so the schema should show no drift.
-- VERIFY LOCALLY (see README "Verifying a hand-written migration"):
--     npx prisma migrate dev
--     npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code     (0 = identical)
--
-- Sections: 1 enums, 2 tables (Prisma-modelled), 3 indexes, 4 foreign keys, then objects Prisma does not model and does
-- not drop: 5 CHECK constraints, 6 partial unique indexes (soft delete), 7 triggers, 8 the product_availability and
-- product_pricing views.
-- Compatible with PostgreSQL 15+.

-- 1. Enums ---------------------------------------------------------------------------------------------------------
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'BUNDLE', 'GIFT_CARD', 'DIGITAL');
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'REFURBISHED');
CREATE TYPE "TaxClass" AS ENUM ('STANDARD', 'ZERO', 'EXEMPT');
CREATE TYPE "BundlePricingMode" AS ENUM ('FIXED', 'DISCOUNT_PERCENT', 'DISCOUNT_FIXED');
CREATE TYPE "SpecType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'ENUM', 'STRING_LIST');
CREATE TYPE "SpecFacet" AS ENUM ('NONE', 'CHECKBOX', 'RANGE', 'TOGGLE');
CREATE TYPE "ShowcaseBlockType" AS ENUM ('IMAGE', 'IMAGE_TEXT', 'FEATURE', 'VIDEO');
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'RELEASED', 'EXPIRED');
CREATE TYPE "AdjustmentReason" AS ENUM ('RECEIVED', 'SOLD', 'CANCEL_RESTOCK', 'RETURN_RESTOCK', 'DAMAGED', 'CORRECTION', 'COUNT', 'OTHER');

-- 2. Tables --------------------------------------------------------------------------------------------------------
CREATE TABLE "category" (
    "id" UUID NOT NULL,
    "parentId" UUID,
    "slug" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "seoTitleEn" TEXT,
    "seoTitleAr" TEXT,
    "seoDescriptionEn" TEXT,
    "seoDescriptionAr" TEXT,
    "imageKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT,
    "websiteUrl" TEXT,
    "logoKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tag" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_tag" (
    "productId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "product_tag_pkey" PRIMARY KEY ("productId","tagId")
);

CREATE TABLE "product" (
    "id" UUID NOT NULL,
    "type" "ProductType" NOT NULL DEFAULT 'PHYSICAL',
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "slug" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "mpn" TEXT,
    "ean" TEXT,
    "brandId" UUID,
    "modelName" TEXT,
    "categoryId" UUID NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "shortDescriptionEn" TEXT,
    "shortDescriptionAr" TEXT,
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "condition" "ProductCondition" NOT NULL DEFAULT 'NEW',
    "price" INTEGER,
    "compareAtPrice" INTEGER,
    "cost" INTEGER,
    "taxClass" "TaxClass" NOT NULL DEFAULT 'STANDARD',
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 3,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 0,
    "weightGrams" INTEGER,
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "specs" JSONB NOT NULL DEFAULT '{}',
    "bundlePricingMode" "BundlePricingMode",
    "bundleDiscountBps" INTEGER,
    "bundleDiscountAmount" INTEGER,
    "seoTitleEn" TEXT,
    "seoTitleAr" TEXT,
    "seoDescriptionEn" TEXT,
    "seoDescriptionAr" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "unitsSold" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_image" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "altEn" TEXT NOT NULL,
    "altAr" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_image_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "showcase_block" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "type" "ShowcaseBlockType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "imageKey" TEXT,
    "imageAltEn" TEXT,
    "imageAltAr" TEXT,
    "titleEn" TEXT,
    "titleAr" TEXT,
    "bodyEn" TEXT,
    "bodyAr" TEXT,
    "captionEn" TEXT,
    "captionAr" TEXT,
    "videoUrl" TEXT,
    "credit" TEXT,
    "licenseNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "showcase_block_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "spec_definition" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "type" "SpecType" NOT NULL,
    "unit" TEXT,
    "labelEn" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "filterable" BOOLEAN NOT NULL DEFAULT false,
    "facet" "SpecFacet" NOT NULL DEFAULT 'NONE',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "spec_definition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bundle_item" (
    "bundleId" UUID NOT NULL,
    "componentId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "swappable" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bundle_item_pkey" PRIMARY KEY ("bundleId","componentId")
);

CREATE TABLE "inventory" (
    "productId" UUID NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("productId")
);

CREATE TABLE "stock_reservation" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "orderId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "stock_reservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_adjustment" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "onHandAfter" INTEGER NOT NULL,
    "reason" "AdjustmentReason" NOT NULL,
    "note" TEXT,
    "actorId" UUID,
    "orderId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_adjustment_pkey" PRIMARY KEY ("id")
);

-- 3. Indexes -------------------------------------------------------------------------------------------------------
CREATE UNIQUE INDEX "category_path_key" ON "category"("path");
CREATE INDEX "category_parentId_sortOrder_idx" ON "category"("parentId", "sortOrder");

CREATE UNIQUE INDEX "brand_slug_key" ON "brand"("slug");
CREATE UNIQUE INDEX "tag_slug_key" ON "tag"("slug");
CREATE INDEX "product_tag_tagId_idx" ON "product_tag"("tagId");

CREATE INDEX "product_categoryId_status_idx" ON "product"("categoryId", "status");
CREATE INDEX "product_brandId_idx" ON "product"("brandId");
CREATE INDEX "product_status_createdAt_idx" ON "product"("status", "createdAt");
CREATE INDEX "product_type_idx" ON "product"("type");
CREATE INDEX "product_unitsSold_idx" ON "product"("unitsSold");
CREATE INDEX "product_viewCount_idx" ON "product"("viewCount");
CREATE INDEX "product_specs_idx" ON "product" USING GIN ("specs");

CREATE INDEX "product_image_productId_sortOrder_idx" ON "product_image"("productId", "sortOrder");
CREATE INDEX "showcase_block_productId_sortOrder_idx" ON "showcase_block"("productId", "sortOrder");
CREATE UNIQUE INDEX "spec_definition_categoryId_key_key" ON "spec_definition"("categoryId", "key");
CREATE INDEX "bundle_item_componentId_idx" ON "bundle_item"("componentId");

CREATE INDEX "stock_reservation_productId_status_expiresAt_idx" ON "stock_reservation"("productId", "status", "expiresAt");
CREATE INDEX "stock_reservation_orderId_idx" ON "stock_reservation"("orderId");
CREATE INDEX "stock_reservation_status_expiresAt_idx" ON "stock_reservation"("status", "expiresAt");
CREATE INDEX "inventory_adjustment_productId_createdAt_idx" ON "inventory_adjustment"("productId", "createdAt");
CREATE INDEX "inventory_adjustment_orderId_idx" ON "inventory_adjustment"("orderId");

-- 4. Foreign keys --------------------------------------------------------------------------------------------------
ALTER TABLE "category" ADD CONSTRAINT "category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_tag" ADD CONSTRAINT "product_tag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_tag" ADD CONSTRAINT "product_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product" ADD CONSTRAINT "product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product" ADD CONSTRAINT "product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "showcase_block" ADD CONSTRAINT "showcase_block_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spec_definition" ADD CONSTRAINT "spec_definition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bundle_item" ADD CONSTRAINT "bundle_item_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bundle_item" ADD CONSTRAINT "bundle_item_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservation" ADD CONSTRAINT "stock_reservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_adjustment" ADD CONSTRAINT "inventory_adjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. CHECK constraints (not modelled by Prisma; Prisma neither reads nor drops them) ------------------------------------
ALTER TABLE "category"
  ADD CONSTRAINT "category_slug_format_chk" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT "category_depth_chk" CHECK ("depth" BETWEEN 1 AND 3),
  ADD CONSTRAINT "category_root_chk" CHECK (("depth" = 1) = ("parentId" IS NULL)),
  ADD CONSTRAINT "category_path_chk" CHECK (
    "path" = "slug" OR right("path", length("slug") + 1) = '/' || "slug"
  ),
  ADD CONSTRAINT "category_path_depth_chk" CHECK (cardinality(string_to_array("path", '/')) = "depth");

ALTER TABLE "brand" ADD CONSTRAINT "brand_slug_format_chk" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "tag" ADD CONSTRAINT "tag_slug_format_chk" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

ALTER TABLE "product"
  ADD CONSTRAINT "product_slug_format_chk" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT "product_sku_format_chk" CHECK ("sku" ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'),
  ADD CONSTRAINT "product_ean_format_chk" CHECK ("ean" IS NULL OR "ean" ~ '^[0-9]{8,14}$'),
  ADD CONSTRAINT "product_price_chk" CHECK ("price" IS NULL OR "price" >= 0),
  ADD CONSTRAINT "product_compare_at_chk" CHECK (
    "compareAtPrice" IS NULL OR ("compareAtPrice" > 0 AND ("price" IS NULL OR "compareAtPrice" > "price"))
  ),
  ADD CONSTRAINT "product_cost_chk" CHECK ("cost" IS NULL OR "cost" >= 0),
  ADD CONSTRAINT "product_low_stock_chk" CHECK ("lowStockThreshold" >= 0),
  ADD CONSTRAINT "product_warranty_chk" CHECK ("warrantyMonths" >= 0),
  ADD CONSTRAINT "product_dimensions_chk" CHECK (
    ("weightGrams" IS NULL OR "weightGrams" > 0) AND ("lengthMm" IS NULL OR "lengthMm" > 0)
    AND ("widthMm" IS NULL OR "widthMm" > 0) AND ("heightMm" IS NULL OR "heightMm" > 0)
  ),
  ADD CONSTRAINT "product_counters_chk" CHECK ("viewCount" >= 0 AND "unitsSold" >= 0),
  ADD CONSTRAINT "product_specs_object_chk" CHECK (jsonb_typeof("specs") = 'object'),
  -- Pricing shape. Every branch spells out IS NOT NULL: a CHECK passes on NULL, so a bare comparison would let NULLs through.
  ADD CONSTRAINT "product_pricing_shape_chk" CHECK (
    CASE "type"
      WHEN 'BUNDLE' THEN
        "cost" IS NULL
        AND "bundlePricingMode" IS NOT NULL
        AND CASE "bundlePricingMode"
          WHEN 'FIXED' THEN
            "price" IS NOT NULL AND "bundleDiscountBps" IS NULL AND "bundleDiscountAmount" IS NULL
          WHEN 'DISCOUNT_PERCENT' THEN
            "price" IS NULL AND "bundleDiscountBps" IS NOT NULL
            AND "bundleDiscountBps" BETWEEN 0 AND 10000 AND "bundleDiscountAmount" IS NULL
          WHEN 'DISCOUNT_FIXED' THEN
            "price" IS NULL AND "bundleDiscountAmount" IS NOT NULL
            AND "bundleDiscountAmount" >= 0 AND "bundleDiscountBps" IS NULL
          ELSE FALSE
        END
      ELSE
        "price" IS NOT NULL AND "bundlePricingMode" IS NULL
        AND "bundleDiscountBps" IS NULL AND "bundleDiscountAmount" IS NULL
    END
  );

ALTER TABLE "showcase_block"
  ADD CONSTRAINT "showcase_block_image_chk" CHECK (
    "type" NOT IN ('IMAGE', 'IMAGE_TEXT')
    OR ("imageKey" IS NOT NULL AND "imageAltEn" IS NOT NULL AND "imageAltAr" IS NOT NULL)
  ),
  ADD CONSTRAINT "showcase_block_feature_chk" CHECK (
    "type" <> 'FEATURE' OR ("titleEn" IS NOT NULL AND "titleAr" IS NOT NULL)
  ),
  ADD CONSTRAINT "showcase_block_video_chk" CHECK (
    ("type" <> 'VIDEO' OR "videoUrl" IS NOT NULL) AND ("videoUrl" IS NULL OR "videoUrl" ~ '^https://')
  );

ALTER TABLE "spec_definition"
  ADD CONSTRAINT "spec_definition_key_format_chk" CHECK ("key" ~ '^[a-z][a-z0-9_]*$'),
  ADD CONSTRAINT "spec_definition_enum_options_chk" CHECK (
    "type" <> 'ENUM'
    OR ("options" IS NOT NULL AND jsonb_typeof("options") = 'array' AND jsonb_array_length("options") > 0)
  ),
  ADD CONSTRAINT "spec_definition_facet_chk" CHECK (("filterable") = ("facet" <> 'NONE')),
  ADD CONSTRAINT "spec_definition_range_chk" CHECK (
    "minValue" IS NULL OR "maxValue" IS NULL OR "minValue" <= "maxValue"
  );

ALTER TABLE "bundle_item" ADD CONSTRAINT "bundle_item_quantity_chk" CHECK ("quantity" BETWEEN 1 AND 50);
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_on_hand_chk" CHECK ("onHand" >= 0);
ALTER TABLE "stock_reservation"
  ADD CONSTRAINT "stock_reservation_quantity_chk" CHECK ("quantity" > 0),
  ADD CONSTRAINT "stock_reservation_resolved_chk" CHECK (("status" = 'ACTIVE') = ("resolvedAt" IS NULL));
ALTER TABLE "inventory_adjustment"
  ADD CONSTRAINT "inventory_adjustment_delta_chk" CHECK ("delta" <> 0),
  ADD CONSTRAINT "inventory_adjustment_after_chk" CHECK ("onHandAfter" >= 0);

-- 6. Partial unique indexes: uniqueness among NON-DELETED products only (soft delete frees the slug, SKU and barcode).
--    Prisma cannot express these, so they are not in schema.prisma; look products up with findFirst({ deletedAt: null }).
CREATE UNIQUE INDEX "product_slug_active_uq" ON "product" ("slug") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "product_sku_active_uq" ON "product" ("sku") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "product_ean_active_uq" ON "product" ("ean") WHERE "ean" IS NOT NULL AND "deletedAt" IS NULL;

-- 7. Triggers: invariants that span rows or tables ----------------------------------------------------------------------
-- Bundle composition: the parent must be a BUNDLE and every component a PHYSICAL product (no nesting).
CREATE FUNCTION "fn_bundle_item_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT "type" FROM "product" WHERE "id" = NEW."bundleId") IS DISTINCT FROM 'BUNDLE' THEN
    RAISE EXCEPTION 'bundle_item.bundleId must reference a BUNDLE product' USING ERRCODE = '23514';
  END IF;
  IF (SELECT "type" FROM "product" WHERE "id" = NEW."componentId") IS DISTINCT FROM 'PHYSICAL' THEN
    RAISE EXCEPTION 'bundle components must be PHYSICAL products (bundles cannot be nested)' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "trg_bundle_item_guard" BEFORE INSERT OR UPDATE ON "bundle_item"
  FOR EACH ROW EXECUTE FUNCTION "fn_bundle_item_guard"();

-- Only PHYSICAL products have stock.
CREATE FUNCTION "fn_inventory_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT "type" FROM "product" WHERE "id" = NEW."productId") IS DISTINCT FROM 'PHYSICAL' THEN
    RAISE EXCEPTION 'inventory rows are only allowed for PHYSICAL products' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "trg_inventory_guard" BEFORE INSERT OR UPDATE OF "productId" ON "inventory"
  FOR EACH ROW EXECUTE FUNCTION "fn_inventory_guard"();

-- A product's type cannot change while stock or bundle membership depends on it.
CREATE FUNCTION "fn_product_type_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "inventory" WHERE "productId" = OLD."id")
     OR EXISTS (SELECT 1 FROM "bundle_item" WHERE "bundleId" = OLD."id" OR "componentId" = OLD."id")
     OR EXISTS (SELECT 1 FROM "stock_reservation" WHERE "productId" = OLD."id" AND "status" = 'ACTIVE') THEN
    RAISE EXCEPTION 'product type cannot change while it has stock, reservations or bundle membership' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "trg_product_type_guard" BEFORE UPDATE OF "type" ON "product"
  FOR EACH ROW WHEN (OLD."type" IS DISTINCT FROM NEW."type") EXECUTE FUNCTION "fn_product_type_guard"();

-- Stock history is append-only.
CREATE FUNCTION "fn_append_only_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '23514';
END $$;
CREATE TRIGGER "trg_inventory_adjustment_append_only" BEFORE UPDATE OR DELETE ON "inventory_adjustment"
  FOR EACH ROW EXECUTE FUNCTION "fn_append_only_guard"();

-- A reservation's product and quantity never change, and a resolved reservation never changes state again.
CREATE FUNCTION "fn_reservation_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."productId" <> OLD."productId" OR NEW."quantity" <> OLD."quantity" THEN
    RAISE EXCEPTION 'reservation product and quantity are immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD."status" <> 'ACTIVE' AND NEW."status" <> OLD."status" THEN
    RAISE EXCEPTION 'a % reservation cannot change status', OLD."status" USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "trg_reservation_guard" BEFORE UPDATE ON "stock_reservation"
  FOR EACH ROW EXECUTE FUNCTION "fn_reservation_guard"();

-- 8. Availability view ---------------------------------------------------------------------------------------------------
-- TIME ZONES: Prisma stores DateTime as UTC in `timestamp` (no zone) columns. Comparing such a column with now() would
-- convert using the SESSION time zone (Cairo on many installs), so every "now" below is timezone('UTC', now()).
-- One row per product. `available` is units that can be sold right now:
--   PHYSICAL  : max(onHand - active unexpired reservations, 0)
--   BUNDLE    : min over components of floor(component available / component quantity); 0 when any component is not
--               ACTIVE or is soft-deleted, and 0 for a bundle with no components (never a drifting stored number)
--   GIFT_CARD / DIGITAL : NULL = not stock-tracked
-- Listings join this view, so there is no per-product query (no N+1).
CREATE VIEW "product_availability" AS
WITH reserved AS (
  SELECT "productId", SUM("quantity")::BIGINT AS qty
  FROM "stock_reservation"
  WHERE "status" = 'ACTIVE' AND "expiresAt" > timezone('UTC', now())
  GROUP BY "productId"
),
stock AS (
  SELECT p."id" AS "productId",
         (p."status" = 'ACTIVE' AND p."deletedAt" IS NULL) AS sellable,
         GREATEST(COALESCE(i."onHand", 0) - COALESCE(r.qty, 0), 0)::BIGINT AS available
  FROM "product" p
  LEFT JOIN "inventory" i ON i."productId" = p."id"
  LEFT JOIN reserved r ON r."productId" = p."id"
  WHERE p."type" = 'PHYSICAL'
)
SELECT s."productId", s.available FROM stock s
UNION ALL
SELECT b."id", COALESCE(MIN(CASE WHEN s.sellable THEN s.available / bi."quantity" ELSE 0 END), 0)::BIGINT
FROM "product" b
JOIN "bundle_item" bi ON bi."bundleId" = b."id"
JOIN stock s ON s."productId" = bi."componentId"
WHERE b."type" = 'BUNDLE'
GROUP BY b."id"
UNION ALL
SELECT b."id", 0::BIGINT
FROM "product" b
WHERE b."type" = 'BUNDLE' AND NOT EXISTS (SELECT 1 FROM "bundle_item" x WHERE x."bundleId" = b."id")
UNION ALL
SELECT p."id", NULL::BIGINT FROM "product" p WHERE p."type" IN ('GIFT_CARD', 'DIGITAL');

-- 9. Pricing view ------------------------------------------------------------------------------------------------------
-- One row per product: the price a customer pays and, for bundles, what the parts cost separately. Bundle prices are
-- DERIVED from current component prices (nothing drifts), exactly like domain/pricing.ts#quoteBundle: percent discounts
-- round half away from zero (numeric ROUND), fixed discounts never go below zero. A DB test asserts the two agree.
CREATE VIEW "product_pricing" AS
SELECT p."id" AS "productId", p."price"::BIGINT AS "effectivePrice", p."price"::BIGINT AS "listTotal"
FROM "product" p
WHERE p."type" <> 'BUNDLE'
UNION ALL
SELECT b."id",
       CASE b."bundlePricingMode"
         WHEN 'FIXED' THEN b."price"::BIGINT
         WHEN 'DISCOUNT_PERCENT' THEN t.total - ROUND(t.total::NUMERIC * b."bundleDiscountBps" / 10000)::BIGINT
         WHEN 'DISCOUNT_FIXED' THEN GREATEST(t.total - b."bundleDiscountAmount", 0)::BIGINT
       END,
       t.total
FROM "product" b
CROSS JOIN LATERAL (
  SELECT COALESCE(SUM(c."price"::BIGINT * bi."quantity"), 0)::BIGINT AS total
  FROM "bundle_item" bi
  JOIN "product" c ON c."id" = bi."componentId"
  WHERE bi."bundleId" = b."id"
) t
WHERE b."type" = 'BUNDLE';
