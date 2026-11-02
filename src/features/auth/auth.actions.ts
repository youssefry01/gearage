"use server";

import { headers } from "next/headers";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendCodeSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@/domain/auth";
import { policies } from "@/domain/rate-limit";
import { locales } from "@/i18n/locales";
import { authedAction, publicAction } from "@/server/actions/client";
import * as auth from "@/server/services/auth.service";
import { z } from "zod";

/**
 * The page language travels as an input (validated against the supported locales): `getLocale()` from next-intl reads
 * route params, which a Server Action does not have. It only picks the language of the emails.
 */
const localeSchema = z.enum(locales);

export const registerAction = publicAction
  .metadata({ policy: policies.registerIp.name })
  .inputSchema(registerSchema.extend({ locale: localeSchema }))
  .action(async ({ parsedInput }) => auth.register(parsedInput, parsedInput.locale));

export const verifyEmailAction = publicAction
  .metadata({ policy: policies.codeVerifyIp.name })
  .inputSchema(verifyEmailSchema)
  .action(async ({ parsedInput }) => auth.verifyEmail(parsedInput.email, parsedInput.code));

export const resendCodeAction = publicAction
  .metadata({ policy: policies.codeSendIp.name })
  .inputSchema(resendCodeSchema.extend({ locale: localeSchema }))
  .action(async ({ parsedInput }) => auth.resendCode(parsedInput.email, parsedInput.locale));

export const loginAction = publicAction
  .metadata({ policy: policies.loginIp.name })
  .inputSchema(loginSchema.extend({ locale: localeSchema }))
  .action(async ({ parsedInput }) =>
    auth.login(parsedInput.email, parsedInput.password, parsedInput.locale),
  );

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
