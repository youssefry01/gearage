-- M5b-2a: email change with re-verification (ADR 0026): three security event types and the pending-request table.
--
-- HAND-WRITTEN. The Prisma schema engine cannot be downloaded in the sandbox this was written in, so this file was NOT
-- produced by `prisma migrate dev`. It follows Prisma's DDL and naming conventions so the schema should show no drift.
-- VERIFY LOCALLY (see README "Verifying a hand-written migration"):
--     npx prisma migrate dev
--     npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code     (0 = identical)
--
-- Sections: 1 enum values, 2 table, 3 indexes, 4 foreign key, 5 CHECK constraints (not modelled by Prisma).
-- Compatible with PostgreSQL 15+. The new enum values are not used inside this migration (PostgreSQL requires the
-- ADD VALUE to be committed before a value is used).

-- 1. Enum values --------------------------------------------------------------------------------------------------
ALTER TYPE "SecurityEventType" ADD VALUE 'EMAIL_CHANGE_REQUESTED';
ALTER TYPE "SecurityEventType" ADD VALUE 'EMAIL_CHANGE_CANCELLED';
ALTER TYPE "SecurityEventType" ADD VALUE 'EMAIL_CHANGED';

-- 2. Table --------------------------------------------------------------------------------------------------------
CREATE TABLE "email_change_request" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "newEmail" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "cancelHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_change_request_pkey" PRIMARY KEY ("id")
);

-- 3. Indexes ------------------------------------------------------------------------------------------------------
CREATE UNIQUE INDEX "email_change_request_userId_key" ON "email_change_request"("userId");
CREATE UNIQUE INDEX "email_change_request_cancelHash_key" ON "email_change_request"("cancelHash");
CREATE INDEX "email_change_request_expiresAt_idx" ON "email_change_request"("expiresAt");

-- 4. Foreign key --------------------------------------------------------------------------------------------------
ALTER TABLE "email_change_request" ADD CONSTRAINT "email_change_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. CHECK constraints (not modelled by Prisma) -------------------------------------------------------------------
-- Both secrets are stored as 64 hex characters (an HMAC-SHA256 digest): a plain code or token cannot be stored by mistake.
ALTER TABLE "email_change_request" ADD CONSTRAINT "email_change_request_code_hash_check" CHECK ("codeHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "email_change_request" ADD CONSTRAINT "email_change_request_cancel_hash_check" CHECK ("cancelHash" ~ '^[0-9a-f]{64}$');
-- The address is always stored normalized, and a counter never goes below zero.
ALTER TABLE "email_change_request" ADD CONSTRAINT "email_change_request_email_normalized_check" CHECK ("newEmail" = lower(btrim("newEmail")) AND length("newEmail") BETWEEN 3 AND 254);
ALTER TABLE "email_change_request" ADD CONSTRAINT "email_change_request_attempts_check" CHECK ("attempts" >= 0);
