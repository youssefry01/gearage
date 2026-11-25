import {
  MAX_ADDRESSES,
  pickNewDefault,
  type AddressData,
  type AddressView,
  type CreateAddressInput,
} from "@/domain/address";
import { policies } from "@/domain/rate-limit";
import { AppError } from "@/lib/errors";
import { getDb } from "@/server/db";
import * as repo from "@/server/repositories/address.repository";
import { enforceLimit } from "@/server/services/enforce-limit";

/**
 * The signed-in person's address book (M5b-2c, ADR 0029). Called by `authedAction`s, which pass the user id from the
 * session. Rules:
 *  - Every query is scoped by that user id. An id that is not theirs behaves EXACTLY like an id that does not exist
 *    (the same NOT_FOUND), so the book is not a way to probe for other people's rows (no IDOR).
 *  - Every write takes the owner's row lock first, so the limit of MAX_ADDRESSES and the one-default rule hold under
 *    concurrent requests (the database also refuses a second default).
 *  - All writes count against one per-account budget (policies.addressWriteUser) BEFORE any work.
 *  - Nothing here logs an address, a name or a phone number.
 */

type Deps = { now?: () => Date };
const clock = (deps: Deps): Date => (deps.now ?? (() => new Date()))();

const notFound = () =>
  new AppError("NOT_FOUND", "Address not found", { details: { issue: "address_not_found" } });

const view = (row: repo.AddressRow): AddressView => ({ ...row });

export async function listAddresses(userId: string): Promise<AddressView[]> {
  // MAX_ADDRESSES + 1: a row past the limit cannot exist, but if it ever did the page would still show it.
  return (await repo.listAddresses(userId, MAX_ADDRESSES + 1)).map(view);
}

/**
 * Adds an address. The first one is always the default; a later one only when `makeDefault` is set. Refused (CONFLICT,
 * issue `address_limit`) when the person already has MAX_ADDRESSES.
 */
export async function createAddress(
  userId: string,
  input: AddressData & Pick<CreateAddressInput, "makeDefault">,
  deps: Deps = {},
): Promise<AddressView> {
  const now = clock(deps);
  await enforceLimit(policies.addressWriteUser, userId);
  const { makeDefault, ...fields } = input;
  return getDb().$transaction(async (tx) => {
    if (!(await repo.lockOwner(userId, tx))) throw notFound();
    const count = await repo.countAddresses(userId, tx);
    if (count >= MAX_ADDRESSES) {
      throw new AppError("CONFLICT", "Address limit reached", {
        details: { issue: "address_limit" },
      });
    }
    const isDefault = count === 0 || makeDefault === true;
    if (isDefault && count > 0) await repo.clearDefault(userId, tx);
    return view(await repo.insertAddress(userId, fields, isDefault, now, tx));
  });
}

/** Replaces the fields of one address. Its default flag does not change here. */
export async function updateAddress(
  userId: string,
  addressId: string,
  fields: AddressData,
  deps: Deps = {},
): Promise<{ status: "saved" }> {
  const now = clock(deps);
  await enforceLimit(policies.addressWriteUser, userId);
  await getDb().$transaction(async (tx) => {
    if (!(await repo.lockOwner(userId, tx))) throw notFound();
    if (!(await repo.updateAddress(userId, addressId, fields, now, tx))) throw notFound();
  });
  return { status: "saved" };
}

export async function setDefaultAddress(
  userId: string,
  addressId: string,
  deps: Deps = {},
): Promise<{ status: "default" }> {
  const now = clock(deps);
  await enforceLimit(policies.addressWriteUser, userId);
  await getDb().$transaction(async (tx) => {
    if (!(await repo.lockOwner(userId, tx))) throw notFound();
    if (!(await repo.getAddress(userId, addressId, tx))) throw notFound();
    await repo.clearDefault(userId, tx);
    await repo.markDefault(userId, addressId, now, tx);
  });
  return { status: "default" };
}

/**
 * Deletes one address (a real delete: orders will hold their own copy, M6b). When it was the default, the most
 * recently updated remaining address becomes the default, so a person with addresses always has exactly one.
 */
export async function deleteAddress(
  userId: string,
  addressId: string,
  deps: Deps = {},
): Promise<{ status: "deleted"; newDefaultId: string | null }> {
  const now = clock(deps);
  await enforceLimit(policies.addressWriteUser, userId);
  return getDb().$transaction(async (tx) => {
    if (!(await repo.lockOwner(userId, tx))) throw notFound();
    const removed = await repo.deleteAddress(userId, addressId, tx);
    if (!removed) throw notFound();
    let newDefaultId: string | null = null;
    if (removed.wasDefault) {
      const next = pickNewDefault(await repo.listAddresses(userId, MAX_ADDRESSES + 1, tx));
      if (next) {
        await repo.markDefault(userId, next.id, now, tx);
        newDefaultId = next.id;
      }
    }
    return { status: "deleted" as const, newDefaultId };
  });
}
