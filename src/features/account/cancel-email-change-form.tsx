"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { cancelTokenSchema } from "@/domain/email-change";
import { Link } from "@/i18n/navigation";
import { cancelEmailChangeAction } from "@/features/auth/auth.actions";
import { FormAlert, useActionErrorText } from "@/features/auth/form-fields";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const readHash = () => window.location.hash;

/**
 * The token arrives in the URL FRAGMENT (`#token=...`), like the password-reset token: a fragment is never sent to a
 * server, so it cannot reach an access log or a Referer header. Opening the link does nothing; the request is only
 * cancelled when this button is pressed (a POST), so a mail scanner that fetches the link cannot cancel it.
 */
export function CancelEmailChangeForm() {
  const t = useTranslations("Account.cancelEmailChange");
  const actionErrorText = useActionErrorText();
  const hash = useSyncExternalStore(subscribe, readHash, () => "");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const doneRef = useRef<HTMLDivElement>(null);
  // The button that was pressed is replaced by the result: move focus there.
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);
  const match = /^#token=(.+)$/.exec(hash);
  const parsed = cancelTokenSchema.safeParse(match ? decodeURIComponent(match[1]!) : "");
  const token = parsed.success ? parsed.data : null;

  if (done) {
    return (
      <div
        ref={doneRef}
        tabIndex={-1}
        className="flex flex-col gap-4 focus-visible:outline-2 focus-visible:outline-offset-2"
        data-testid="cancel-done"
      >
        <p role="status" className="border-success text-success rounded-control border px-3 py-2">
          {t("done")}
        </p>
        <p className="text-small text-muted-foreground">{t("advice")}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={routes.forgotPassword}
            className={`${buttonStyles({ variant: "primary" })} w-full sm:w-auto`}
          >
            {t("resetLink")}
          </Link>
          <Link
            href={routes.login}
            className={`${buttonStyles({ variant: "secondary" })} w-full sm:w-auto`}
          >
            {t("signInLink")}
          </Link>
        </div>
      </div>
    );
  }

  if (!token) return <FormAlert>{t("missingToken")}</FormAlert>;

  async function cancel() {
    if (!token) return;
    setBusy(true);
    setError(undefined);
    const res = await cancelEmailChangeAction({ token });
    setBusy(false);
    if (res.data) {
      // Do not keep the used token in the address bar or history.
      window.history.replaceState(null, "", window.location.pathname);
      setDone(true);
      return;
    }
    setError(actionErrorText(res.serverError));
  }

  return (
    <div className="flex flex-col gap-4">
      <FormAlert>{error}</FormAlert>
      <Button
        onClick={() => void cancel()}
        disabled={busy}
        className="w-full sm:w-auto sm:self-start"
      >
        {busy ? t("submitting") : t("submit")}
      </Button>
    </div>
  );
}
