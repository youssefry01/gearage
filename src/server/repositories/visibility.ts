import { Prisma } from "@/generated/prisma/client";

/**
 * THE rule for "a shopper may see this product", as a SQL condition over the aliases `p` (product), `cat` (its
 * category) and `b` (its brand, LEFT JOINed). Listings, product pages, related products and the sitemap all use it,
 * so a product can never be visible in one place and hidden in another:
 * ACTIVE, not soft-deleted, in an active category, and not of a deactivated brand (no brand is fine).
 */
export const VISIBLE_PRODUCT = Prisma.sql`p."status" = 'ACTIVE' AND p."deletedAt" IS NULL AND cat."isActive" AND (b."id" IS NULL OR b."isActive")`;
