-- M5b-2c: the address book (ADR 0029): one table, its indexes, its foreign key and its CHECK constraints.
--
-- HAND-WRITTEN. The Prisma schema engine cannot be downloaded in the sandbox this was written in, so this file was NOT
-- produced by `prisma migrate dev`. It follows Prisma's DDL and naming conventions so the schema should show no drift.
-- VERIFY LOCALLY (see README "Verifying a hand-written migration"):
--     npx prisma migrate dev
--     npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code     (0 = identical)
--
-- Sections: 1 table, 2 indexes, 3 foreign key, 4 partial unique index and CHECK constraints (not modelled by Prisma).

-- 1. Table --------------------------------------------------------------------------------------------------------
CREATE TABLE "address" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "label" TEXT,
    "recipientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "governorate" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "floor" TEXT,
    "apartment" TEXT,
    "landmark" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_pkey" PRIMARY KEY ("id")
);

-- 2. Indexes ------------------------------------------------------------------------------------------------------
CREATE INDEX "address_userId_createdAt_idx" ON "address"("userId", "createdAt");

-- 3. Foreign key --------------------------------------------------------------------------------------------------
ALTER TABLE "address" ADD CONSTRAINT "address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Partial unique index and CHECK constraints (not modelled by Prisma) ------------------------------------------
-- At most one default address per account: the database refuses a second one whatever the code does.
CREATE UNIQUE INDEX "address_user_default_uq" ON "address" ("userId") WHERE "isDefault";

-- Required lines are never blank and never longer than the form allows (the limits are ADDRESS_LIMITS in
-- src/domain/address.ts; a test compares them). Optional lines are NULL or non-blank.
ALTER TABLE "address" ADD CONSTRAINT "address_required_text_check" CHECK (
    char_length(btrim("recipientName")) BETWEEN 1 AND 80
    AND char_length(btrim("city")) BETWEEN 1 AND 60
    AND char_length(btrim("area")) BETWEEN 1 AND 60
    AND char_length(btrim("street")) BETWEEN 1 AND 120
    AND char_length(btrim("building")) BETWEEN 1 AND 40
);
ALTER TABLE "address" ADD CONSTRAINT "address_optional_text_check" CHECK (
    ("label" IS NULL OR char_length(btrim("label")) BETWEEN 1 AND 30)
    AND ("floor" IS NULL OR char_length(btrim("floor")) BETWEEN 1 AND 20)
    AND ("apartment" IS NULL OR char_length(btrim("apartment")) BETWEEN 1 AND 20)
    AND ("landmark" IS NULL OR char_length(btrim("landmark")) BETWEEN 1 AND 120)
);
-- Egyptian mobile in E.164 (+20, then 1 and 0/1/2/5, then eight digits), as on the profile.
ALTER TABLE "address" ADD CONSTRAINT "address_phone_check" CHECK ("phone" ~ '^\+201[0125][0-9]{8}$');
-- A governorate CODE (lower-case words joined by hyphens). Which codes exist is application data (the list changes by
-- decree), so the database checks the shape only; the application validates membership.
ALTER TABLE "address" ADD CONSTRAINT "address_governorate_check" CHECK ("governorate" ~ '^[a-z]+(-[a-z]+)*$' AND char_length("governorate") <= 24);
