"use server";

import { addressIdSchema, createAddressSchema, updateAddressSchema } from "@/domain/address";
import { policies } from "@/domain/rate-limit";
import { authedAction } from "@/server/actions/client";
import * as addresses from "@/server/services/address.service";

/**
 * Address-book Server Actions (M5b-2c, ADR 0029). Every one is an `authedAction`: the session is proved BEFORE any work
 * runs, the owner's id comes from that session and never from the client, and each declares its rate-limit policy
 * (a structure test enforces both). The writes also share a per-account budget inside the service.
 */

export const createAddressAction = authedAction
  .metadata({ policy: policies.authSession.name })
  .inputSchema(createAddressSchema)
  .action(async ({ parsedInput, ctx }) =>
    addresses.createAddress(ctx.session.user.id, parsedInput),
  );

export const updateAddressAction = authedAction
  .metadata({ policy: policies.authSession.name })
  .inputSchema(updateAddressSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { addressId, ...fields } = parsedInput;
    return addresses.updateAddress(ctx.session.user.id, addressId, fields);
  });

export const setDefaultAddressAction = authedAction
  .metadata({ policy: policies.authSession.name })
  .inputSchema(addressIdSchema)
  .action(async ({ parsedInput, ctx }) =>
    addresses.setDefaultAddress(ctx.session.user.id, parsedInput.addressId),
  );

export const deleteAddressAction = authedAction
  .metadata({ policy: policies.authSession.name })
  .inputSchema(addressIdSchema)
  .action(async ({ parsedInput, ctx }) =>
    addresses.deleteAddress(ctx.session.user.id, parsedInput.addressId),
  );
