-- M5a-2: authentication tables (ADR 0002, ADR 0024): Better Auth's user/session/account/verification plus login_throttle.
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
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- 2. Tables -------------------------------------------------------------------------------------------------------
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "gender" "Gender",
    "locale" TEXT NOT NULL DEFAULT 'en',
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "privacyAcceptedAt" TIMESTAMP(3) NOT NULL,
    "privacyVersion" TEXT NOT NULL,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingConsentAt" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" UUID NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "account" (
    "id" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "login_throttle" (
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_throttle_pkey" PRIMARY KEY ("key")
);

-- 3. Indexes ------------------------------------------------------------------------------------------------------
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");
CREATE INDEX "session_userId_idx" ON "session"("userId");
CREATE INDEX "account_userId_idx" ON "account"("userId");
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");
CREATE INDEX "login_throttle_lastFailureAt_idx" ON "login_throttle"("lastFailureAt");

-- 4. Foreign keys -------------------------------------------------------------------------------------------------
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. CHECK constraints (not modelled by Prisma) -------------------------------------------------------------------
-- Email is stored lower-case (Better Auth lower-cases it; this makes the unique index case-insensitive in practice).
ALTER TABLE "user" ADD CONSTRAINT "user_email_lowercase_check" CHECK ("email" = lower("email"));
-- Consent is evidence: a marketing opt-in always carries its time, and an opt-out never does.
ALTER TABLE "user" ADD CONSTRAINT "user_marketing_consent_time_check" CHECK (("marketingConsent" AND "marketingConsentAt" IS NOT NULL) OR (NOT "marketingConsent" AND "marketingConsentAt" IS NULL));
ALTER TABLE "login_throttle" ADD CONSTRAINT "login_throttle_failures_check" CHECK ("failures" >= 1);
