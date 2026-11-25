"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ADDRESS_LIMITS, createAddressSchema, type CreateAddressInput } from "@/domain/address";
import { sortedGovernorates, type GovernorateCode } from "@/domain/egypt-governorates";
import {
  Checkbox,
  FormAlert,
  PhoneField,
  phoneRegisterOptions,
  TextField,
  useErrorText,
} from "@/features/auth/form-fields";
import { zodResolver } from "@/features/auth/zod-resolver";
import type { Locale } from "@/i18n/locales";
import { createAddressAction, updateAddressAction } from "./address.actions";
import { useAccountActionError } from "./use-account-action-error";

/** What the form holds. Optional lines are "" when empty; the server turns "" into "not set". */
export type AddressFormValues = {
  label: string;
  recipientName: string;
  /** The way people write it (01012345678). */
  phone: string;
  governorate: string;
  city: string;
  area: string;
  street: string;
  building: string;
  floor: string;
  apartment: string;
  landmark: string;
};

export const emptyAddressValues = (
  defaults: Pick<AddressFormValues, "recipientName" | "phone">,
): AddressFormValues => ({
  label: "",
  recipientName: defaults.recipientName,
  phone: defaults.phone,
  governorate: "",
  city: "",
  area: "",
  street: "",
  building: "",
  floor: "",
  apartment: "",
  landmark: "",
});

type FormInput = CreateAddressInput;

/**
 * Add or edit one address. The same component will serve checkout (M6b). Every field has a visible label and a
 * translated error; the governorate is a native select (works on every phone, keyboard and screen reader); a server
 * refusal (limit reached, address gone) shows in the form alert. The first address is always the default, so the
 * "make default" box only appears when there is already one.
 */
export function AddressForm({
  locale,
  mode,
  addressId,
  initial,
  showMakeDefault,
  onSaved,
  onCancel,
}: {
  locale: Locale;
  mode: "add" | "edit";
  addressId?: string;
  initial: AddressFormValues;
  /** Add mode only: offer "use as my default" (false for the very first address). */
  showMakeDefault: boolean;
  onSaved: (kind: "added" | "saved") => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Account.addresses");
  const errorText = useErrorText();
  const actionError = useAccountActionError();
  const [formError, setFormError] = useState<string>();
  const governorates = useMemo(() => sortedGovernorates(locale), [locale]);
  const selectId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(createAddressSchema),
    defaultValues: {
      ...initial,
      governorate: initial.governorate as GovernorateCode,
      makeDefault: false,
    },
    mode: "onTouched",
  });

  // Opening the form moves focus to its heading, so a keyboard or screen-reader user lands where the new content is.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const err = (name: keyof FormInput) => errorText(errors[name]?.message);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    const res =
      mode === "edit" && addressId
        ? await updateAddressAction({ ...values, addressId })
        : await createAddressAction(values);
    if (res.data) {
      onSaved(mode === "edit" ? "saved" : "added");
      return;
    }
    if (res.serverError?.field && res.serverError.issue) {
      setError(
        res.serverError.field as keyof FormInput,
        { message: res.serverError.issue },
        { shouldFocus: true },
      );
      return;
    }
    if (res.validationErrors) {
      setFormError(errorText("generic"));
      return;
    }
    setFormError(actionError(res.serverError));
  });

  const governorateError = err("governorate");
  const governorateErrorId = `${selectId}-error`;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="border-border bg-card rounded-panel flex flex-col gap-5 border p-5 sm:p-6"
      data-testid="address-form"
      aria-labelledby={`${selectId}-title`}
    >
      <h2
        id={`${selectId}-title`}
        ref={headingRef}
        tabIndex={-1}
        className="text-heading font-semibold text-balance outline-none"
      >
        {mode === "edit" ? t("formEditTitle") : t("formAddTitle")}
      </h2>
      <FormAlert>{formError}</FormAlert>
      <TextField
        label={t("label")}
        hint={t("labelHint")}
        autoComplete="off"
        maxLength={ADDRESS_LIMITS.label}
        error={err("label")}
        {...register("label")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label={t("recipientName")}
          autoComplete="name"
          maxLength={ADDRESS_LIMITS.recipientName}
          error={err("recipientName")}
          {...register("recipientName")}
        />
        <PhoneField
          label={t("phone")}
          error={err("phone")}
          {...register("phone", phoneRegisterOptions)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="text-small font-semibold">
          {t("governorate")}
        </label>
        <select
          id={selectId}
          aria-invalid={governorateError ? true : undefined}
          aria-describedby={governorateError ? governorateErrorId : undefined}
          autoComplete="address-level1"
          className="border-input bg-background rounded-control aria-invalid:border-danger min-h-11 w-full border px-3 py-2"
          {...register("governorate")}
        >
          <option value="">{t("governorateChoose")}</option>
          {governorates.map((g) => (
            <option key={g.code} value={g.code}>
              {g.name}
            </option>
          ))}
        </select>
        {governorateError ? (
          <p id={governorateErrorId} role="alert" className="text-small text-danger">
            {governorateError}
          </p>
        ) : null}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label={t("city")}
          autoComplete="address-level2"
          maxLength={ADDRESS_LIMITS.city}
          error={err("city")}
          {...register("city")}
        />
        <TextField
          label={t("area")}
          autoComplete="address-level3"
          maxLength={ADDRESS_LIMITS.area}
          error={err("area")}
          {...register("area")}
        />
      </div>
      <TextField
        label={t("street")}
        autoComplete="address-line1"
        maxLength={ADDRESS_LIMITS.street}
        error={err("street")}
        {...register("street")}
      />
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField
          label={t("building")}
          autoComplete="address-line2"
          maxLength={ADDRESS_LIMITS.building}
          error={err("building")}
          {...register("building")}
        />
        <TextField
          label={t("floor")}
          autoComplete="off"
          maxLength={ADDRESS_LIMITS.floor}
          error={err("floor")}
          {...register("floor")}
        />
        <TextField
          label={t("apartment")}
          autoComplete="off"
          maxLength={ADDRESS_LIMITS.apartment}
          error={err("apartment")}
          {...register("apartment")}
        />
      </div>
      <TextField
        label={t("landmark")}
        hint={t("landmarkHint")}
        autoComplete="off"
        maxLength={ADDRESS_LIMITS.landmark}
        error={err("landmark")}
        {...register("landmark")}
      />
      {mode === "add" && showMakeDefault ? (
        <Checkbox id={`${selectId}-default`} {...register("makeDefault")}>
          {t("makeDefault")}
        </Checkbox>
      ) : null}
      {mode === "add" && !showMakeDefault ? (
        <p className="text-small text-muted-foreground">{t("firstIsDefault")}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("submitting") : mode === "edit" ? t("submitEdit") : t("submitAdd")}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
