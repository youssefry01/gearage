import { AsyncLocalStorage } from "node:async_hooks";
import type { Locale } from "@/i18n/locales";

/**
 * Per-call context for the Better Auth callbacks. They receive an email address and a code, but not the language of the
 * page the person is using, and they run before the new user is visible to any other connection. The service that calls
 * Better Auth wraps the call in `runWithAuthContext`; the callbacks read the locale from here and report each queued
 * email id back, so the service can dispatch them after the response (ADR 0022) instead of inside the request.
 */
export type AuthCallContext = { locale: Locale; queuedEmailIds: string[] };

const storage = new AsyncLocalStorage<AuthCallContext>();

export function runWithAuthContext<T>(
  locale: Locale,
  fn: () => Promise<T>,
): Promise<{ value: T; queuedEmailIds: string[] }> {
  const ctx: AuthCallContext = { locale, queuedEmailIds: [] };
  return storage.run(ctx, async () => {
    const value = await fn();
    return { value, queuedEmailIds: ctx.queuedEmailIds };
  });
}

export const currentAuthContext = (): AuthCallContext | undefined => storage.getStore();
