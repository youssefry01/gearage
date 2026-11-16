"use client";

import { useState } from "react";
import { routes } from "@/config/routes";
import { useAccountStateStore } from "@/features/account/account-state-store";
import { useRouter } from "@/i18n/navigation";
import { logoutAction } from "./auth.actions";

/**
 * Signs this device out and goes home. The action is awaited BEFORE navigating, and the server is asked once more who is
 * signed in: only if it says nobody is (an unanswered question counts as "not yet") does the page move on. So a URL that has changed to the home page is the proof
 * that the session is gone (e2e waits for it instead of guessing; navigating earlier cancels the in-flight Server
 * Action and leaves the session alive), and a sign-out that failed says so instead of pretending. Used by the account
 * menu in the header and by the account pages.
 */
export function useSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function signOut() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await logoutAction({});
      await useAccountStateStore.getState().refresh();
      if (useAccountStateStore.getState().status !== "signed-out") {
        setFailed(true);
        return;
      }
      router.replace(routes.home);
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return { signOut, busy, failed };
}
