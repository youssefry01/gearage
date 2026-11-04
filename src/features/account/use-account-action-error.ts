"use client";

import { routes } from "@/config/routes";
import { useRouter } from "@/i18n/navigation";
import type { ActionError } from "@/server/actions/client";
import { useActionErrorText } from "@/features/auth/form-fields";

/**
 * Turns a failed account action into text for the form alert. A session that ended while the page was open
 * (UNAUTHENTICATED) is not "incorrect email or password": the person is sent to sign in and brought back here.
 */
export function useAccountActionError() {
  const actionErrorText = useActionErrorText();
  const router = useRouter();
  return (error: ActionError | undefined): string | undefined => {
    if (error?.code === "UNAUTHENTICATED") {
      router.replace(`${routes.login}?next=${encodeURIComponent(window.location.pathname)}`);
      return undefined;
    }
    return actionErrorText(error);
  };
}
