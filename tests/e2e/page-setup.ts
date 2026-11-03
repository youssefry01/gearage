import { readFile } from "node:fs/promises";
import type { BrowserContext } from "@playwright/test";
import { AUTH_STATE_FILE } from "./e2e-env";
import { addPendingVerification } from "./pending-cookie";
import { SIGNED_IN_PAGES, VERIFY_PAGE } from "./viewports";

/** Gives a context what a page in the matrices needs: the pending-verification cookie, or a signed-in session. */
export async function preparePage(
  context: BrowserContext,
  baseURL: string,
  path: string,
): Promise<void> {
  if (path === VERIFY_PAGE) await addPendingVerification(context, baseURL);
  if ((SIGNED_IN_PAGES as readonly string[]).includes(path.split("?")[0]!)) {
    const state = JSON.parse(await readFile(AUTH_STATE_FILE, "utf8")) as {
      cookies: Parameters<BrowserContext["addCookies"]>[0];
    };
    await context.addCookies(state.cookies);
  }
}
