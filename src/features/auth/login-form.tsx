"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { Locale } from "@/i18n/locales";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { loginSchema, type LoginInput } from "@/domain/auth";
import { Link, useRouter } from "@/i18n/navigation";
import { loginAction } from "./auth.actions";
import {
  FormAlert,
  PasswordField,
  TextField,
  useActionErrorText,
  useErrorText,
} from "./form-fields";
import { zodResolver } from "./zod-resolver";

/** `next` was already checked by the server (`safeNextPath`); it is a same-site path. */
export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("Auth");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const errorText = useErrorText();
  const actionErrorText = useActionErrorText();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), mode: "onTouched" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    const res = await loginAction({ ...values, locale });
    if (res.data?.status === "ok") {
      router.replace(next);
      router.refresh();
      return;
    }
    if (res.data?.status === "unverified") {
      router.push(routes.verifyEmail); // the address travels in a signed cookie, not in the URL (ADR 0024)
      return;
    }
    setFormError(actionErrorText(res.serverError));
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert>{formError}</FormAlert>
      <TextField
        label={t("fields.email")}
        type="email"
        autoComplete="username"
        inputMode="email"
        dir="ltr"
        error={errorText(errors.email?.message)}
        {...register("email")}
      />
      <PasswordField
        label={t("fields.password")}
        autoComplete="current-password"
        error={errorText(errors.password?.message)}
        {...register("password")}
      />
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t("login.submitting") : t("login.submit")}
      </Button>
      <p className="text-small">
        <Link
          href={routes.forgotPassword}
          className="text-link inline-flex min-h-11 items-center underline"
        >
          {t("login.forgot")}
        </Link>
      </p>
    </form>
  );
}
