import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db";
import type { Tx } from "@/server/repositories/inventory.repository";

type Db = Tx | ReturnType<typeof getDb>;

/** Everything an address holds. Every query here is scoped by the owner's id: an id from another account matches nothing. */
export type AddressRow = {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  governorate: string;
  city: string;
  area: string;
  street: string;
  building: string;
  floor: string | null;
  apartment: string | null;
  landmark: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const select = {
  id: true,
  label: true,
  recipientName: true,
  phone: true,
  governorate: true,
  city: true,
  area: true,
  street: true,
  building: true,
  floor: true,
  apartment: true,
  landmark: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type AddressFields = Omit<AddressRow, "id" | "isDefault" | "createdAt" | "updatedAt">;

/**
 * Serializes every address write of ONE account: takes the account row's lock for the rest of the transaction. The
 * limit of ten and the one-default rule are checks across rows, which only hold if two writers of the same account
 * cannot interleave. Other accounts are not affected.
 */
export async function lockOwner(userId: string, db: Tx): Promise<boolean> {
  const rows = await db.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT "id" FROM "user" WHERE "id" = ${userId}::uuid FOR UPDATE`,
  );
  return rows.length === 1;
}

/** Default first, then newest first (id last, so the order is total). */
export async function listAddresses(
  userId: string,
  limit: number,
  db: Db = getDb(),
): Promise<AddressRow[]> {
  return db.address.findMany({
    where: { userId },
    select,
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    take: limit,
  });
}

export async function countAddresses(userId: string, db: Db = getDb()): Promise<number> {
  return db.address.count({ where: { userId } });
}

export async function getAddress(
  userId: string,
  addressId: string,
  db: Db = getDb(),
): Promise<AddressRow | null> {
  return db.address.findFirst({ where: { id: addressId, userId }, select });
}

export async function insertAddress(
  userId: string,
  fields: AddressFields,
  isDefault: boolean,
  now: Date,
  db: Db = getDb(),
): Promise<AddressRow> {
  return db.address.create({
    data: { userId, ...fields, isDefault, createdAt: now, updatedAt: now },
    select,
  });
}

/** True when a row of this account was changed. */
export async function updateAddress(
  userId: string,
  addressId: string,
  fields: AddressFields,
  now: Date,
  db: Db = getDb(),
): Promise<boolean> {
  const result = await db.address.updateMany({
    where: { id: addressId, userId },
    data: { ...fields, updatedAt: now },
  });
  return result.count === 1;
}

/** Clears the default flag of the account's addresses (always before setting a new one: the unique index allows one). */
export async function clearDefault(userId: string, db: Db = getDb()): Promise<void> {
  await db.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
}

export async function markDefault(
  userId: string,
  addressId: string,
  now: Date,
  db: Db = getDb(),
): Promise<boolean> {
  const result = await db.address.updateMany({
    where: { id: addressId, userId },
    data: { isDefault: true, updatedAt: now },
  });
  return result.count === 1;
}

/** Deletes one address of the account and says whether it was the default (null: it was not there / not theirs). */
export async function deleteAddress(
  userId: string,
  addressId: string,
  db: Db = getDb(),
): Promise<{ wasDefault: boolean } | null> {
  const rows = await db.$queryRaw<{ isDefault: boolean }[]>(
    Prisma.sql`DELETE FROM "address" WHERE "id" = ${addressId}::uuid AND "userId" = ${userId}::uuid RETURNING "isDefault"`,
  );
  const row = rows[0];
  return row ? { wasDefault: row.isDefault } : null;
}
