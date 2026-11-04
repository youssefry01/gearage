"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { FormAlert } from "@/features/auth/form-fields";
import { revokeOtherSessionsAction, revokeSessionAction } from "./account.actions";
import { useAccountActionError } from "./use-account-action-error";

/** A session as the page shows it. All text is already translated and formatted on the server (see format-datetime.ts). */
export type SessionItem = {
  id: string;
  device: string;
  signedIn: string;
  lastActive: string;
  current: boolean;
};

/**
 * The list of signed-in devices. The current one is marked and has no button (it signs out with the normal "Sign out");
 * every other one can be signed out on its own, and one bulk action signs out all the others and keeps this one.
 */
export function SessionsPanel({ sessions }: { sessions: SessionItem[] }) {
  const t = useTranslations("Account.security.sessions");
  const router = useRouter();
  const actionError = useAccountActionError();
  const [busy, setBusy] = useState<string | "others" | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const others = sessions.filter((s) => !s.current);

  async function signOutOne(id: string) {
    setBusy(id);
    setError(undefined);
    setNotice(undefined);
    const res = await revokeSessionAction({ sessionId: id });
    setBusy(null);
    if (res.data) {
      setNotice(t("revoked"));
      router.refresh();
    } else setError(actionError(res.serverError));
  }

  async function signOutOthers() {
    setBusy("others");
    setError(undefined);
    setNotice(undefined);
    const res = await revokeOtherSessionsAction({});
    setBusy(null);
    if (res.data) {
      setNotice(t("othersRevoked"));
      router.refresh();
    } else setError(actionError(res.serverError));
  }

  return (
    <div className="flex flex-col gap-4">
      <FormAlert>{error}</FormAlert>
      {notice ? (
        <p
          role="status"
          className="border-success text-success text-small rounded-control border px-3 py-2"
          data-testid="sessions-notice"
        >
          {notice}
        </p>
      ) : null}
      <ul aria-label={t("list")} className="flex flex-col gap-3" data-testid="sessions-list">
        {sessions.map((s) => (
          <li
            key={s.id}
            data-testid={s.current ? "session-current" : "session-other"}
            className="border-border rounded-control flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-semibold break-words">
                <span data-testid="session-device">{s.device}</span>
                {s.current ? (
                  <span className="bg-secondary text-secondary-foreground text-small ms-2 inline-block rounded-full px-2 py-0.5 font-semibold">
                    {t("thisDevice")}
                  </span>
                ) : null}
              </p>
              <p className="text-small text-muted-foreground">
                {t("signedIn", { when: s.signedIn })}
              </p>
              <p className="text-small text-muted-foreground">
                {t("lastActive", { when: s.lastActive })}
              </p>
            </div>
            {s.current ? null : (
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() => void signOutOne(s.id)}
                aria-label={t("signOutDevice", { device: s.device })}
                className="w-full sm:w-auto"
              >
                {busy === s.id ? t("signingOut") : t("signOut")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-small text-muted-foreground">{t("times")}</p>
      {others.length > 0 ? (
        <div>
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={() => void signOutOthers()}
            className="w-full sm:w-auto"
            data-testid="sign-out-others"
          >
            {busy === "others" ? t("signingOut") : t("signOutOthers")}
          </Button>
        </div>
      ) : (
        <p className="text-small text-muted-foreground">{t("noOthers")}</p>
      )}
    </div>
  );
}
