-- M5b-2a follow-up: the revert after an email change (ADR 0027): one security event type and the reservation table.
--
-- HAND-WRITTEN. The Prisma schema engine cannot be downloaded in the sandbox this was written in, so this file was NOT
-- produced by `prisma migrate dev`. It follows Prisma's DDL and naming conventions so the schema should show no drift.
-- VERIFY LOCALLY (see README "Verifying a hand-written migration"):
--     npx prisma migrate dev
--     npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code     (0 = identical)
--
-- Sections: 1 enum value, 2 table, 3 indexes, 4 foreign key, 5 CHECK constraints (not modelled by Prisma).
-- The new enum value is not used inside this migration (PostgreSQL requires ADD VALUE to be committed before use).

-- 1. Enum value ---------------------------------------------------------------------------------------------------
ALTER TYPE "SecurityEventType" ADD VALUE 'EMAIL_CHANGE_REVERTED';

-- 2. Table --------------------------------------------------------------------------------------------------------
CREATE TABLE "email_change_revert" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "oldEmail" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_change_revert_pkey" PRIMARY KEY ("id")
);

-- 3. Indexes ------------------------------------------------------------------------------------------------------
CREATE UNIQUE INDEX "email_change_revert_oldEmail_key" ON "email_change_revert"("oldEmail");
CREATE UNIQUE INDEX "email_change_revert_tokenHash_key" ON "email_change_revert"("tokenHash");
CREATE INDEX "email_change_revert_userId_idx" ON "email_change_revert"("userId");
CREATE INDEX "email_change_revert_expiresAt_idx" ON "email_change_revert"("expiresAt");

-- 4. Foreign key --------------------------------------------------------------------------------------------------
ALTER TABLE "email_change_revert" ADD CONSTRAINT "email_change_revert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. CHECK constraints (not modelled by Prisma) -------------------------------------------------------------------
-- The token is stored as 64 hex characters (an HMAC-SHA256 digest): a plain token cannot be stored by mistake.
ALTER TABLE "email_change_revert" ADD CONSTRAINT "email_change_revert_token_hash_check" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');
-- Both addresses are stored normalized, and a window always ends after it starts.
ALTER TABLE "email_change_revert" ADD CONSTRAINT "email_change_revert_email_normalized_check" CHECK ("oldEmail" = lower(btrim("oldEmail")) AND "newEmail" = lower(btrim("newEmail")) AND length("oldEmail") BETWEEN 3 AND 254 AND length("newEmail") BETWEEN 3 AND 254);
ALTER TABLE "email_change_revert" ADD CONSTRAINT "email_change_revert_window_check" CHECK ("expiresAt" > "createdAt");
