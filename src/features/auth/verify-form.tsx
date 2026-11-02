"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { Locale } from "@/i18n/locales";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { verifyEmailSchema, type VerifyEmailInput } from "@/domain/auth";
import { useRouter } from "@/i18n/navigation";
import { resendCodeAction, verifyEmailAction } from "./auth.actions";
import { FormAlert, TextField, useActionErrorText, useErrorText } from "./form-fields";
import { zodResolver } from "./zod-resolver";

export function VerifyForm({ email }: { email: string }) {
  const t = useTranslations("Auth");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const errorText = useErrorText();
  const actionErrorText = useActionErrorText();
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [resending, setResending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email },
    mode: "onSubmit",
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    setNotice(undefined);
    const res = await verifyEmailAction(values);
    if (res.data?.status === "verified") {
      router.replace(routes.account);
      router.refresh();
      return;
    }
    setFormError(actionErrorText(res.serverError));
  });

  async function resend() {
    setFormError(undefined);
    setNotice(undefined);
    setResending(true);
    const res = await resendCodeAction({ email, locale });
    setResending(false);
    if (res.data) setNotice(t("verify.resent"));
    else setFormError(actionErrorText(res.serverError));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <input type="hidden" {...register("email")} />
      <FormAlert>{formError}</FormAlert>
      {notice ? (
        <p role="status" className="text-small text-success">
          {notice}
        </p>
      ) : null}
      <TextField
        label={t("verify.codeLabel")}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={12}
        dir="ltr"
        className="text-center tracking-[0.4em]"
        error={errorText(errors.code?.message ?? errors.email?.message)}
        {...register("code")}
      />
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t("verify.submitting") : t("verify.submit")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={resend}
        disabled={resending}
        className="w-full"
      >
        {t("verify.resend")}
      </Button>
    </form>
  );
}
