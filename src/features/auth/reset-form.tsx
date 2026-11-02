"use client";

import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { resetPasswordSchema, resetTokenSchema } from "@/domain/auth";
import { Link, useRouter } from "@/i18n/navigation";
import { resetPasswordAction } from "./auth.actions";
import { FormAlert, PasswordField, useActionErrorText, useErrorText } from "./form-fields";
import { StrengthMeter } from "./strength-meter";
import { zodResolver } from "./zod-resolver";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const readHash = () => window.location.hash;

/**
 * The reset token arrives in the URL FRAGMENT (`#token=...`): browsers never send a fragment to any server, so it
 * cannot appear in access logs, CDN logs or a Referer header. Opening the link does nothing by itself; the token is
 * only used when this form is submitted (a POST), which is what consumes it.
 */
export function ResetForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const errorText = useErrorText();
  const actionErrorText = useActionErrorText();
  const hash = useSyncExternalStore(subscribe, readHash, () => "");
  const [formError, setFormError] = useState<string>();
  const tokenMatch = /^#token=(.+)$/.exec(hash);
  const parsed = resetTokenSchema.safeParse(tokenMatch ? decodeURIComponent(tokenMatch[1]!) : "");
  const token = parsed.success ? parsed.data : null;

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ token: string; password: string }>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
  });
  const password = useWatch({ control, name: "password" }) ?? "";

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert>{t("reset.missingToken")}</FormAlert>
        <Link
          href={routes.forgotPassword}
          className="text-link inline-flex min-h-11 items-center underline"
        >
          {t("reset.requestNew")}
        </Link>
      </div>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    const res = await resetPasswordAction({ token, password: values.password });
    if (res.data) {
      // Do not keep the used token in the address bar or history.
      window.history.replaceState(null, "", window.location.pathname);
      router.replace(`${routes.login}?reset=1`);
      return;
    }
    if (res.serverError?.field === "password" && res.serverError.issue) {
      setError("password", { message: res.serverError.issue });
      return;
    }
    setFormError(actionErrorText(res.serverError));
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert>{formError}</FormAlert>
      <input type="hidden" value={token} {...register("token")} />
      <PasswordField
        label={t("reset.newPassword")}
        autoComplete="new-password"
        hint={t("fields.passwordHint")}
        error={errorText(errors.password?.message)}
        below={<StrengthMeter password={password} userInputs={[]} />}
        {...register("password")}
      />
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t("reset.submitting") : t("reset.submit")}
      </Button>
    </form>
  );
}
