"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type ClipboardEvent } from "react";
import { useForm } from "react-hook-form";
import type { Locale } from "@/i18n/locales";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import {
  CODE_LENGTH,
  sanitizeCodeInput,
  verifyCodeSchema,
  type VerifyCodeInput,
} from "@/domain/auth";
import { useRouter } from "@/i18n/navigation";
import { resendCodeAction, verifyEmailAction } from "./auth.actions";
import { FormAlert, TextField, useActionErrorText, useErrorText } from "./form-fields";
import { zodResolver } from "./zod-resolver";

/**
 * The address being verified is NOT a prop or a field: the server reads it from the signed pending-verification
 * cookie (ADR 0024). The field takes digits only, pastes "123 456" as 123456, and submits itself at six digits.
 */
export function VerifyForm() {
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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VerifyCodeInput>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { code: "" },
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

  /** Writes a cleaned value into the field and submits when it is complete. */
  function applyCode(raw: string, input: HTMLInputElement) {
    const clean = sanitizeCodeInput(raw);
    input.value = clean;
    setValue("code", clean, { shouldValidate: false });
    if (clean.length === CODE_LENGTH && !isSubmitting) void onSubmit();
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    // maxLength would cut "123 456" at six characters BEFORE the spaces are removed, so a paste is cleaned here.
    event.preventDefault();
    applyCode(event.clipboardData.getData("text"), event.currentTarget);
  }

  async function resend() {
    setFormError(undefined);
    setNotice(undefined);
    setResending(true);
    const res = await resendCodeAction({ locale });
    setResending(false);
    if (res.data) setNotice(t("verify.resent"));
    else setFormError(actionErrorText(res.serverError));
  }

  const codeField = register("code", {
    onChange: (e: { target: HTMLInputElement }) => applyCode(e.target.value, e.target),
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert>{formError}</FormAlert>
      {notice ? (
        <p role="status" className="text-small text-success">
          {notice}
        </p>
      ) : null}
      <TextField
        label={t("verify.codeLabel")}
        hint={t("verify.codeHint")}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        dir="ltr"
        className="text-center tracking-[0.4em]"
        error={errorText(errors.code?.message)}
        onPaste={onPaste}
        {...codeField}
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
