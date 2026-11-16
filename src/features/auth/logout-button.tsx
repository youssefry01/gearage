"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useSignOut } from "./use-sign-out";

export function LogoutButton({ className }: { className?: string }) {
  const t = useTranslations("Auth.account");
  const { signOut, busy, failed } = useSignOut();
  return (
    <>
      <Button
        variant="secondary"
        onClick={signOut}
        disabled={busy}
        className={className}
        data-testid="logout"
      >
        {busy ? t("loggingOut") : t("logout")}
      </Button>
      {failed ? (
        <p role="alert" className="text-danger text-small">
          {t("logoutFailed")}
        </p>
      ) : null}
    </>
  );
}
