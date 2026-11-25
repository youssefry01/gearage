import { z } from "zod";
import { phoneSchema } from "@/domain/auth";
import { GOVERNORATE_CODES, governorateName } from "@/domain/egypt-governorates";

/**
 * The address book (M5b-2c, ADR 0029). Pure: no I/O, no framework. Zod messages are CODES the UI translates under
 * `Auth.errors`, like every account form.
 */

/** A person keeps at most this many addresses (decided 2026-11-17). Enforced under a row lock in the service. */
export const MAX_ADDRESSES = 10;

// Field limits, repeated in the migration's CHECK constraints (a database test pins that they agree).
export const ADDRESS_LIMITS = {
  label: 30,
  recipientName: 80,
  city: 60,
  area: 60,
  street: 120,
  building: 40,
  floor: 20,
  apartment: 20,
  landmark: 120,
} as const;

/** Control characters (including line breaks) never belong in an address line. */
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

/** Trims and collapses runs of whitespace to one space ("Nasr  City " -> "Nasr City"). */
export function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const text = (max: number) =>
  z
    .string({ error: "required" })
    .refine((v) => !CONTROL.test(v), { error: "invalid_text" })
    .transform(tidy)
    .pipe(z.string().max(max, { error: "too_long" }));

const requiredText = (max: number) => text(max).pipe(z.string().min(1, { error: "required" }));

/**
 * Optional text: empty, `null` or absent all become `null`, so "clear it" and "never set" are the same stored value.
 * (A missing key must still run the transform, hence the preprocess instead of an `.optional()` that would skip it.)
 */
const optionalText = (max: number) =>
  z
    .preprocess((v) => (v === null || v === undefined ? "" : v), text(max))
    .transform((v) => (v === "" ? null : v));

/** Letters (any script), marks, spaces, apostrophes, hyphens and dots: names in Arabic and Latin script. */
const recipient = requiredText(ADDRESS_LIMITS.recipientName).pipe(
  z.string().regex(/^[\p{L}\p{M}][\p{L}\p{M}\s'’.\-]*$/u, { error: "invalid_name" }),
);

/** What the address form sends (and the actions accept). The id and the default flag are NOT part of it. */
export const addressSchema = z.object({
  label: optionalText(ADDRESS_LIMITS.label),
  recipientName: recipient,
  phone: phoneSchema,
  governorate: z.enum(GOVERNORATE_CODES, { error: "invalid_governorate" }),
  city: requiredText(ADDRESS_LIMITS.city),
  area: requiredText(ADDRESS_LIMITS.area),
  street: requiredText(ADDRESS_LIMITS.street),
  building: requiredText(ADDRESS_LIMITS.building),
  floor: optionalText(ADDRESS_LIMITS.floor),
  apartment: optionalText(ADDRESS_LIMITS.apartment),
  landmark: optionalText(ADDRESS_LIMITS.landmark),
});
export type AddressInput = z.input<typeof addressSchema>;
export type AddressData = z.output<typeof addressSchema>;

export const createAddressSchema = addressSchema.extend({
  /** Ignored for the first address, which is always the default. */
  makeDefault: z.boolean().optional(),
});
export type CreateAddressInput = z.input<typeof createAddressSchema>;

export const addressIdSchema = z.object({ addressId: z.uuid({ error: "invalid_address" }) });
export const updateAddressSchema = addressSchema.extend(addressIdSchema.shape);

/** An address as the pages and (in M6b) the checkout see it. */
/** `governorate` is a plain string here: it is stored data, and a code removed from the list must still display. */
export type AddressView = Omit<AddressData, "governorate"> & {
  governorate: string;
  id: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * The postal lines in reading order for a language: building and street, area, city and governorate, then the
 * optional floor, apartment and landmark. Used on the cards now, and by the order summary and the invoice later.
 */
export function formatAddressLines(
  a: Pick<
    AddressView,
    "governorate" | "city" | "area" | "street" | "building" | "floor" | "apartment" | "landmark"
  >,
  locale: "en" | "ar",
  words: { floor: string; apartment: string; landmark: string },
): string[] {
  const unit = [
    a.floor ? `${words.floor} ${a.floor}` : null,
    a.apartment ? `${words.apartment} ${a.apartment}` : null,
  ].filter((v): v is string => v !== null);
  return [
    `${a.building}, ${a.street}`,
    unit.length ? unit.join(", ") : null,
    `${a.area}, ${a.city}`,
    governorateName(a.governorate, locale),
    a.landmark ? `${words.landmark}: ${a.landmark}` : null,
  ].filter((v): v is string => v !== null);
}

/** After deleting the default, which address takes over: the most recently updated of the rest (ties: newest created). */
export function pickNewDefault<T extends { id: string; updatedAt: Date; createdAt: Date }>(
  rest: readonly T[],
): T | null {
  if (rest.length === 0) return null;
  return [...rest].sort(
    (x, y) =>
      y.updatedAt.getTime() - x.updatedAt.getTime() ||
      y.createdAt.getTime() - x.createdAt.getTime() ||
      (x.id < y.id ? -1 : 1),
  )[0]!;
}
