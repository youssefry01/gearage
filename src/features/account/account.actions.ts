"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { changePasswordSchema, profileSchema, sessionIdSchema } from "@/domain/account";
import { deviceFromUserAgent } from "@/domain/device";
import { policies } from "@/domain/rate-limit";
import { locales } from "@/i18n/locales";
import { authedAction } from "@/server/actions/client";
import * as account from "@/server/services/account.service";

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
