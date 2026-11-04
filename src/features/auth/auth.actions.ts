"use server";

import { headers } from "next/headers";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyCodeSchema,
} from "@/domain/auth";
import { deviceFromUserAgent } from "@/domain/device";
import { policies } from "@/domain/rate-limit";
import { locales } from "@/i18n/locales";
import { authedAction, publicAction } from "@/server/actions/client";
import { clearPendingEmail, getPendingEmail, setPendingEmail } from "@/server/auth/pending";
import { AppError } from "@/lib/errors";
import * as auth from "@/server/services/auth.service";
import { z } from "zod";

/**
 * The page language travels as an input (validated against the supported locales): `getLocale()` from next-intl reads
 * route params, which a Server Action does not have. It only picks the language of the emails.
 */
const localeSchema = z.enum(locales);

/**
 * The coarse device label of this request ("chrome/windows"), derived here so the raw User-Agent never reaches the
 * service layer or Better Auth, let alone the database (ADR 0025).
 */
async function requestDevice(): Promise<string | null> {
  return deviceFromUserAgent((await headers()).get("user-agent"));
}

export const registerAction = publicAction
  .metadata({ policy: policies.registerIp.name })
  .inputSchema(registerSchema.extend({ locale: localeSchema }))
  .action(async ({ parsedInput }) => {
    const result = await auth.register(parsedInput, parsedInput.locale);
    // Same cookie whether or not the address already has an account (no enumeration); see server/auth/pending.ts.
    await setPendingEmail(parsedInput.email);
    return result;
  });

/** The address comes from the signed pending-verification cookie, never from the client (ADR 0024). */
async function pendingEmailOrFail(): Promise<string> {
  const email = await getPendingEmail();
  if (!email) {
    throw new AppError("BAD_REQUEST", "No verification in progress", {
      details: { issue: "verification_expired" },
    });
  }
  return email;
}

export const verifyEmailAction = publicAction
  .metadata({ policy: policies.codeVerifyIp.name })
  .inputSchema(verifyCodeSchema)
  .action(async ({ parsedInput }) => {
    const result = await auth.verifyEmail(await pendingEmailOrFail(), parsedInput.code, {
      device: await requestDevice(),
    });
    await clearPendingEmail();
    return result;
  });

export const resendCodeAction = publicAction
  .metadata({ policy: policies.codeSendIp.name })
  .inputSchema(z.object({ locale: localeSchema }))
  .action(async ({ parsedInput }) =>
    auth.resendCode(await pendingEmailOrFail(), parsedInput.locale),
  );

export const loginAction = publicAction
  .metadata({ policy: policies.loginIp.name })
  .inputSchema(loginSchema.extend({ locale: localeSchema }))
  .action(async ({ parsedInput }) => {
    const result = await auth.login(parsedInput.email, parsedInput.password, parsedInput.locale, {
      device: await requestDevice(),
    });
    // A correct password on an unverified account sends the person to the verify page, which needs the address.
    if (result.status === "unverified") await setPendingEmail(parsedInput.email);
    return result;
  });

export const logoutAction = authedAction
  .metadata({ policy: policies.authSession.name })
  .inputSchema(z.object({}))
  .action(async () => {
    await auth.logout(await headers());
    return { status: "signed-out" as const };
  });

export const forgotPasswordAction = publicAction
  .metadata({ policy: policies.resetRequestIp.name })
  .inputSchema(forgotPasswordSchema.extend({ locale: localeSchema }))
  .action(async ({ parsedInput }) =>
    auth.requestPasswordReset(parsedInput.email, parsedInput.locale),
  );

export const resetPasswordAction = publicAction
  .metadata({ policy: policies.resetConfirmIp.name })
  .inputSchema(resetPasswordSchema)
  .action(async ({ parsedInput }) => auth.resetPassword(parsedInput.token, parsedInput.password));
