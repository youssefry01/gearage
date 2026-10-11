-- Baseline: extensions + store settings.
-- Hand-written in a sandbox without the Prisma schema engine; confirm locally with:
--   npx prisma migrate dev   (then `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code` must report no drift)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable
CREATE TABLE "store_setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_setting_pkey" PRIMARY KEY ("key")
);
