"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { changePasswordSchema, type ChangePasswordInput } from "@/domain/account";
import type { Locale } from "@/i18n/locales";
import { useRouter } from "@/i18n/navigation";
import { FormAlert, PasswordField, useErrorText } from "@/features/auth/form-fields";
import { StrengthMeter } from "@/features/auth/strength-meter";
import { zodResolver } from "@/features/auth/zod-resolver";
import { changePasswordAction } from "./account.actions";
import { useAccountActionError } from "./use-account-action-error";

/**
 * Changes the password: current password, then a new one. Same rules as registration (12 to 128 characters, any
 * language, spaces allowed, no composition rules, not in a known breach), with the same advisory strength meter.
 * `username` is passed so a password manager updates the right saved login; `userInputs` are penalised as guessable.
 */
export function PasswordForm({ username, userInputs }: { username: string; userInputs: string[] }) {
  const t = useTranslations("Account.security.password");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const errorText = useErrorText();
  const actionError = useAccountActionError();
  const [formError, setFormError] = useState<string>();
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onTouched",
  });
  const newPassword = useWatch({ control, name: "newPassword" }) ?? "";
  const th = useTranslations("Auth.fields");

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    setDone(false);
    const res = await changePasswordAction({ ...values, locale });
    if (res.data) {
      reset({ currentPassword: "", newPassword: "" });
      setDone(true);
      router.refresh(); // the sessions and activity lists below changed
      return;
    }
    if (res.serverError?.field && res.serverError.issue) {
      setError(
        res.serverError.field as keyof ChangePasswordInput,
        { message: res.serverError.issue },
        { shouldFocus: true },
      );
      return;
    }
    setFormError(actionError(res.serverError));
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5"
      data-testid="password-form"
    >
      <FormAlert>{formError}</FormAlert>
      {done ? (
        <p
          role="status"
          className="border-success text-success text-small rounded-control border px-3 py-2"
          data-testid="password-changed"
        >
          {t("done")}
        </p>
      ) : null}
      {/* Lets a password manager attach the new password to the right login; invisible and not in the tab order. */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        spellCheck={false}
        value={username}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
      <PasswordField
        label={t("current")}
        autoComplete="current-password"
        error={errorText(errors.currentPassword?.message)}
        {...register("currentPassword")}
      />
      <PasswordField
        label={t("new")}
        autoComplete="new-password"
        hint={th("passwordHint")}
        error={errorText(errors.newPassword?.message)}
        below={<StrengthMeter password={newPassword} userInputs={userInputs} />}
        {...register("newPassword")}
      />
      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto sm:self-start">
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
