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
  FormAlert,
  PasswordField,
  TextField,
  useActionErrorText,
  useErrorText,
  Checkbox,
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
      const email = values.email.trim().toLowerCase();
      router.push(`${routes.verifyEmail}?email=${encodeURIComponent(email)}`);
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
      <TextField
        label={t("fields.phone")}
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        dir="ltr"
        hint={t("fields.phoneHint")}
        error={err("phone")}
        {...register("phone")}
      />
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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gender" className="text-small font-semibold">
          {t("fields.gender")}
        </label>
        <select
          id="gender"
          className="border-input bg-background rounded-control min-h-11 w-full border px-3 py-2"
          {...register("gender")}
        >
          <option value="">{t("fields.genderNone")}</option>
          <option value="male">{t("fields.genderMale")}</option>
          <option value="female">{t("fields.genderFemale")}</option>
        </select>
      </div>

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
