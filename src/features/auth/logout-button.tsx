"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { useRouter } from "@/i18n/navigation";
import { logoutAction } from "./auth.actions";

export function LogoutButton() {
  const t = useTranslations("Auth.account");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    await logoutAction({});
    router.replace(routes.home);
    router.refresh();
  }
  return (
    <Button variant="secondary" onClick={logout} disabled={busy} data-testid="logout">
      {busy ? t("loggingOut") : t("logout")}
    </Button>
  );
}
