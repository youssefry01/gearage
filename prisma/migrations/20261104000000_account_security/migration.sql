-- M5b-1: account security (ADR 0025): a coarse device label on sessions and the per-account security activity log.
--
-- HAND-WRITTEN. The Prisma schema engine cannot be downloaded in the sandbox this was written in, so this file was NOT
-- produced by `prisma migrate dev`. It follows Prisma's DDL and naming conventions so the schema should show no drift.
-- VERIFY LOCALLY (see README "Verifying a hand-written migration"):
--     npx prisma migrate dev
--     npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code     (0 = identical)
--
-- Sections: 1 enum, 2 session column, 3 table, 4 indexes, 5 foreign key, 6 CHECK constraints (not modelled by Prisma).
-- Compatible with PostgreSQL 15+. Existing sessions keep a NULL device (the list shows "Unknown device" for them).

-- 1. Enum ---------------------------------------------------------------------------------------------------------
CREATE TYPE "SecurityEventType" AS ENUM ('SIGN_IN', 'PASSWORD_CHANGED', 'PASSWORD_RESET', 'SESSION_REVOKED', 'OTHER_SESSIONS_REVOKED');

-- 2. Session column -----------------------------------------------------------------------------------------------
ALTER TABLE "session" ADD COLUMN "device" TEXT;

-- 3. Table --------------------------------------------------------------------------------------------------------
CREATE TABLE "security_event" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "SecurityEventType" NOT NULL,
    "device" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_event_pkey" PRIMARY KEY ("id")
);

-- 4. Indexes ------------------------------------------------------------------------------------------------------
CREATE INDEX "security_event_userId_createdAt_idx" ON "security_event"("userId", "createdAt");
CREATE INDEX "security_event_createdAt_idx" ON "security_event"("createdAt");

-- 5. Foreign key --------------------------------------------------------------------------------------------------
ALTER TABLE "security_event" ADD CONSTRAINT "security_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. CHECK constraints (not modelled by Prisma) -------------------------------------------------------------------
-- A device label is two short lower-case codes joined by a slash ("chrome/windows"). A raw User-Agent string contains
-- spaces, parentheses and semicolons, so it cannot pass: the data-minimization promise is enforced by the database.
ALTER TABLE "session" ADD CONSTRAINT "session_device_format_check" CHECK ("device" IS NULL OR "device" ~ '^[a-z0-9-]{1,24}/[a-z0-9-]{1,24}$');
ALTER TABLE "security_event" ADD CONSTRAINT "security_event_device_format_check" CHECK ("device" IS NULL OR "device" ~ '^[a-z0-9-]{1,24}/[a-z0-9-]{1,24}$');
-- Only sign-in events carry a device label (decision of 2026-11-04).
ALTER TABLE "security_event" ADD CONSTRAINT "security_event_device_signin_check" CHECK ("device" IS NULL OR "type" = 'SIGN_IN');
