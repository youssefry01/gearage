"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { changePasswordSchema, profileSchema, sessionIdSchema } from "@/domain/account";
import { confirmEmailChangeSchema, requestEmailChangeSchema } from "@/domain/email-change";
import { deviceFromUserAgent } from "@/domain/device";
import { policies } from "@/domain/rate-limit";
import { locales } from "@/i18n/locales";
import { authedAction } from "@/server/actions/client";
import * as account from "@/server/services/account.service";
import * as emailChange from "@/server/services/email-change.service";

/**
 * Account-area Server Actions (M5b-1, ADR 0025). Every one is an `authedAction`: the session is proved BEFORE any work
 * runs, the person's id and session id come from that session and never from the client, and each declares its
 * rate-limit policy (a structure test enforces both).
 */

export const updateProfileAction = authedAction
  .metadata({ policy: policies.authSession.name })
  .inputSchema(profileSchema)
  .action(async ({ parsedInput, ctx }) => account.updateProfile(ctx.session.user.id, parsedInput));

export const changePasswordAction = authedAction
  .metadata({ policy: policies.passwordChangeIp.name })
  .inputSchema(changePasswordSchema.extend({ locale: z.enum(locales) }))
  .action(async ({ parsedInput, ctx }) =>
    account.changePassword({
      userId: ctx.session.user.id,
      email: ctx.session.user.email,
      sessionId: ctx.session.sessionId,
      currentPassword: parsedInput.currentPassword,
      newPassword: parsedInput.newPassword,
      locale: parsedInput.locale,
      device: deviceFromUserAgent((await headers()).get("user-agent")),
    }),
  );

export const revokeSessionAction = authedAction
  .metadata({ policy: policies.authSession.name })
  .inputSchema(sessionIdSchema)
  .action(async ({ parsedInput, ctx }) =>
    account.revokeSession(ctx.session.user.id, ctx.session.sessionId, parsedInput.sessionId),
  );

export const revokeOtherSessionsAction = authedAction
  .metadata({ policy: policies.authSession.name })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) =>
    account.revokeOtherSessions(ctx.session.user.id, ctx.session.sessionId),
  );

// --- Email change (M5b-2a, ADR 0026) -------------------------------------------------------------------------------

export const requestEmailChangeAction = authedAction
  .metadata({ policy: policies.emailChangeIp.name })
  .inputSchema(requestEmailChangeSchema.extend({ locale: z.enum(locales) }))
  .action(async ({ parsedInput, ctx }) =>
    emailChange.requestEmailChange({
      userId: ctx.session.user.id,
      currentEmail: ctx.session.user.email,
      newEmail: parsedInput.newEmail,
      currentPassword: parsedInput.currentPassword,
      locale: parsedInput.locale,
      device: deviceFromUserAgent((await headers()).get("user-agent")),
    }),
  );

export const resendEmailChangeCodeAction = authedAction
  .metadata({ policy: policies.emailChangeIp.name })
  .inputSchema(z.object({ locale: z.enum(locales) }))
  .action(async ({ parsedInput, ctx }) =>
    emailChange.resendEmailChangeCode({ userId: ctx.session.user.id, locale: parsedInput.locale }),
  );

export const confirmEmailChangeAction = authedAction
  .metadata({ policy: policies.emailChangeIp.name })
  .inputSchema(confirmEmailChangeSchema.extend({ locale: z.enum(locales) }))
  .action(async ({ parsedInput, ctx }) =>
    emailChange.confirmEmailChange({
      userId: ctx.session.user.id,
      sessionId: ctx.session.sessionId,
      currentEmail: ctx.session.user.email,
      code: parsedInput.code,
      locale: parsedInput.locale,
    }),
  );

export const discardEmailChangeAction = authedAction
  .metadata({ policy: policies.authSession.name })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => emailChange.discardEmailChange(ctx.session.user.id));
