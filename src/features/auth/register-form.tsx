"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { Locale } from "@/i18n/locales";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { registerSchema, type RegisterInput } from "@/domain/auth";
import { Link, useRouter } from "@/i18n/navigation";
import { registerAction } from "./auth.actions";
import {
  Checkbox,
  FormAlert,
  GenderSelect,
  PasswordField,
  PhoneField,
  phoneRegisterOptions,
  TextField,
  useActionErrorText,
  useErrorText,
} from "./form-fields";
import { StrengthMeter } from "./strength-meter";
import { zodResolver } from "./zod-resolver";

export function RegisterForm() {
  const t = useTranslations("Auth");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const errorText = useErrorText();
  const actionErrorText = useActionErrorText();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { gender: undefined, marketingConsent: false },
    mode: "onTouched",
  });
  const [passwordValue, firstName, lastName, emailValue] = useWatch({
    control,
    name: ["password", "firstName", "lastName", "email"],
  });
  const password = passwordValue ?? "";
  const userInputs = [firstName, lastName, emailValue].filter(
    (v): v is string => typeof v === "string" && v.length > 1,
  );

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    const res = await registerAction({ ...values, locale });
    if (res.data) {
      router.push(routes.verifyEmail); // the address travels in a signed cookie, not in the URL (ADR 0024)
      return;
    }
    if (res.serverError?.field && res.serverError.issue) {
      setError(res.serverError.field as keyof RegisterInput, { message: res.serverError.issue });
      return;
    }
    setFormError(actionErrorText(res.serverError));
  });

  const err = (name: keyof RegisterInput) => errorText(errors[name]?.message);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert>{formError}</FormAlert>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label={t("fields.firstName")}
          autoComplete="given-name"
          error={err("firstName")}
          {...register("firstName")}
        />
        <TextField
          label={t("fields.lastName")}
          autoComplete="family-name"
          error={err("lastName")}
          {...register("lastName")}
        />
      </div>
      <TextField
        label={t("fields.email")}
        type="email"
        autoComplete="email"
        inputMode="email"
        dir="ltr"
        error={err("email")}
        {...register("email")}
      />
      <PhoneField error={err("phone")} {...register("phone", phoneRegisterOptions)} />
      <PasswordField
        label={t("fields.password")}
        autoComplete="new-password"
        hint={t("fields.passwordHint")}
        error={err("password")}
        below={<StrengthMeter password={password} userInputs={userInputs} />}
        {...register("password")}
      />
      <TextField
        label={t("fields.dateOfBirth")}
        type="date"
        autoComplete="bday"
        dir="ltr"
        error={err("dateOfBirth")}
        {...register("dateOfBirth")}
      />
      <GenderSelect {...register("gender")} />

      <div className="flex flex-col gap-1">
        <Checkbox
          id="accept-terms"
          error={Boolean(errors.acceptTerms)}
          errorId="terms-error"
          {...register("acceptTerms")}
        >
          <span>
            {t("register.termsPrefix")}{" "}
            <Link href={routes.terms} target="_blank" className="inline-link text-link underline">
              {t("register.termsLink")}
            </Link>{" "}
            {t("register.and")}{" "}
            <Link href={routes.privacy} target="_blank" className="inline-link text-link underline">
              {t("register.privacyLink")}
            </Link>
          </span>
        </Checkbox>
        {errors.acceptTerms ? (
          <p id="terms-error" role="alert" className="text-small text-danger">
            {err("acceptTerms")}
          </p>
        ) : null}
        <Checkbox id="marketing" {...register("marketingConsent")}>
          {t("register.marketing")}
        </Checkbox>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t("register.submitting") : t("register.submit")}
      </Button>
    </form>
  );
}
