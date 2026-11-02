-- M5a-1: cross-cutting infrastructure (ADR 0021 rate-limit fallback, ADR 0022 email outbox, ADR 0023 view counts).
--
-- HAND-WRITTEN. The Prisma schema engine cannot be downloaded in the sandbox this was written in, so this file was NOT
-- produced by `prisma migrate dev`. It follows Prisma's DDL and naming conventions so the schema should show no drift.
-- VERIFY LOCALLY (see README "Verifying a hand-written migration"):
--     npx prisma migrate dev
--     npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code     (0 = identical)
--
-- Sections: 1 enum, 2 tables (Prisma-modelled), 3 indexes, 4 foreign keys, 5 CHECK constraints (not modelled by Prisma).
-- Compatible with PostgreSQL 15+.

-- 1. Enum ---------------------------------------------------------------------------------------------------------
CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'EXPIRED');

-- 2. Tables -------------------------------------------------------------------------------------------------------
CREATE TABLE "rate_limit_counter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_counter_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "email_outbox" (
    "id" UUID NOT NULL,
    "template" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "EmailOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_view_daily" (
    "productId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "product_view_daily_pkey" PRIMARY KEY ("productId","day")
);

-- 3. Indexes ------------------------------------------------------------------------------------------------------
CREATE INDEX "rate_limit_counter_expiresAt_idx" ON "rate_limit_counter"("expiresAt");
CREATE INDEX "email_outbox_status_nextAttemptAt_idx" ON "email_outbox"("status", "nextAttemptAt");
CREATE INDEX "email_outbox_createdAt_idx" ON "email_outbox"("createdAt");
CREATE INDEX "product_view_daily_day_idx" ON "product_view_daily"("day");

-- 4. Foreign keys -------------------------------------------------------------------------------------------------
ALTER TABLE "product_view_daily" ADD CONSTRAINT "product_view_daily_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. CHECK constraints (not modelled by Prisma) -------------------------------------------------------------------
ALTER TABLE "rate_limit_counter" ADD CONSTRAINT "rate_limit_counter_count_chk" CHECK ("count" >= 1);
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_attempts_chk" CHECK ("attempts" >= 0);
-- A finished row never keeps its secret: SENT, FAILED and EXPIRED rows carry an empty payload.
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_payload_cleared_chk" CHECK ("status" IN ('PENDING', 'SENDING') OR "payload" = '{}'::jsonb);
ALTER TABLE "product_view_daily" ADD CONSTRAINT "product_view_daily_count_chk" CHECK ("count" >= 1);
