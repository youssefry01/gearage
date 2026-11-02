"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  RESET_EXPIRES_MINUTES,
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/domain/auth";
import type { Locale } from "@/i18n/locales";
import { forgotPasswordAction } from "./auth.actions";
import { FormAlert, TextField, useActionErrorText, useErrorText } from "./form-fields";
import { zodResolver } from "./zod-resolver";

export function ForgotForm() {
  const t = useTranslations("Auth");
  const locale = useLocale() as Locale;
  const errorText = useErrorText();
  const actionErrorText = useActionErrorText();
  const [formError, setFormError] = useState<string>();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    const res = await forgotPasswordAction({ ...values, locale });
    if (res.data) setSent(true);
    else setFormError(actionErrorText(res.serverError));
  });

  if (sent) {
    // The same message whether or not an account exists.
    return (
      <p role="status" data-testid="forgot-sent">
        {t("forgot.sent", { minutes: RESET_EXPIRES_MINUTES })}
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert>{formError}</FormAlert>
      <TextField
        label={t("fields.email")}
        type="email"
        autoComplete="email"
        inputMode="email"
        dir="ltr"
        error={errorText(errors.email?.message)}
        {...register("email")}
      />
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t("forgot.submitting") : t("forgot.submit")}
      </Button>
    </form>
  );
}
