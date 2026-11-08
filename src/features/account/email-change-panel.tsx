"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { CODE_LENGTH, sanitizeCodeInput } from "@/domain/auth";
import {
  confirmEmailChangeSchema,
  requestEmailChangeSchema,
  type ConfirmEmailChangeInput,
  type RequestEmailChangeInput,
} from "@/domain/email-change";
import type { Locale } from "@/i18n/locales";
import { useRouter } from "@/i18n/navigation";
import { FormAlert, PasswordField, TextField, useErrorText } from "@/features/auth/form-fields";
import { zodResolver } from "@/features/auth/zod-resolver";
import {
  confirmEmailChangeAction,
  discardEmailChangeAction,
  requestEmailChangeAction,
  resendEmailChangeCodeAction,
} from "./account.actions";
import { useAccountActionError } from "./use-account-action-error";

/** A pending change as the page shows it. Already masked and formatted on the server. */
export type PendingView = { addressMasked: string; until: string; attemptsLeft: number };

/**
 * Change the email address (ADR 0026). Two states, both driven by the server (a reload shows the same one):
 *  - nothing pending: the new address and the CURRENT password;
 *  - a change pending: the 6-digit code that was sent to the new address, with "send a new code" and "use a different
 *    address". The wording never says whether the new address already has an account.
 */
export function EmailChangePanel({ pending }: { pending: PendingView | null }) {
  const t = useTranslations("Account.email");
  const [changed, setChanged] = useState(false);
  const [justStarted, setJustStarted] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // The code form that was just replaced by "changed" had focus: move it to the confirmation so keyboard and
  // screen-reader users are not dropped at the top of the page.
  useEffect(() => {
    if (changed) bannerRef.current?.focus();
  }, [changed]);

  return (
    <div className="flex flex-col gap-5">
      {/* The live region is always in the page; only its content appears (an inserted region is often not announced). */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {changed ? (
          <div
            ref={bannerRef}
            tabIndex={-1}
            className="border-success text-success text-small rounded-control flex flex-col gap-1 border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            data-testid="email-changed"
          >
            <p>{t("changed")}</p>
            <p>{t("signInNote")}</p>
          </div>
        ) : null}
      </div>
      {pending ? (
        <CodeForm pending={pending} focusOnMount={justStarted} onChanged={() => setChanged(true)} />
      ) : (
        <RequestForm
          onStarted={() => {
            setChanged(false);
            setJustStarted(true);
          }}
        />
      )}
    </div>
  );
}

function RequestForm({ onStarted }: { onStarted: () => void }) {
  const t = useTranslations("Account.email");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const errorText = useErrorText();
  const actionError = useAccountActionError();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RequestEmailChangeInput>({
    resolver: zodResolver(requestEmailChangeSchema),
    defaultValues: { newEmail: "", currentPassword: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    const res = await requestEmailChangeAction({ ...values, locale });
    if (res.data) {
      onStarted();
      reset({ newEmail: "", currentPassword: "" }); // the password is never kept around
      router.refresh(); // the server now shows the code step
      return;
    }
    const field = res.serverError?.field;
    if ((field === "currentPassword" || field === "newEmail") && res.serverError?.issue) {
      setError(field, { message: res.serverError.issue }, { shouldFocus: true });
      return;
    }
    setFormError(actionError(res.serverError));
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5"
      data-testid="email-request-form"
    >
      <FormAlert>{formError}</FormAlert>
      <TextField
        label={t("new")}
        type="email"
        autoComplete="email"
        inputMode="email"
        dir="ltr"
        spellCheck={false}
        autoCapitalize="none"
        error={errorText(errors.newEmail?.message)}
        {...register("newEmail")}
      />
      <PasswordField
        label={t("password")}
        autoComplete="current-password"
        error={errorText(errors.currentPassword?.message)}
        {...register("currentPassword")}
      />
      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto sm:self-start">
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}

function CodeForm({
  pending,
  focusOnMount,
  onChanged,
}: {
  pending: PendingView;
  /** True when the person just submitted the first step: the button that had focus is gone, so focus the heading. */
  focusOnMount: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("Account.email");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const errorText = useErrorText();
  const actionError = useAccountActionError();
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState<"resend" | "discard" | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount]);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ConfirmEmailChangeInput>({
    resolver: zodResolver(confirmEmailChangeSchema),
    defaultValues: { code: "" },
    mode: "onSubmit",
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    setNotice(undefined);
    const res = await confirmEmailChangeAction({ ...values, locale });
    if (res.data) {
      onChanged();
      router.refresh();
      return;
    }
    setFormError(actionError(res.serverError));
    // A dead request (expired, too many wrong codes, address taken meanwhile) is gone on the server: show the start again.
    const issue = res.serverError?.issue;
    if (
      issue === "expired_code" ||
      issue === "too_many_attempts" ||
      issue === "no_email_change" ||
      issue === "email_unavailable"
    ) {
      router.refresh();
    } else if (issue === "invalid_code") {
      router.refresh(); // the attempts-left count changed
    }
  });

  /** Writes a cleaned value into the field and submits when it is complete (same behaviour as the verify page). */
  function applyCode(raw: string, input: HTMLInputElement) {
    const clean = sanitizeCodeInput(raw);
    input.value = clean;
    setValue("code", clean, { shouldValidate: false });
    if (clean.length === CODE_LENGTH && !isSubmitting) void onSubmit();
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    applyCode(event.clipboardData.getData("text"), event.currentTarget);
  }

  async function resend() {
    setBusy("resend");
    setFormError(undefined);
    setNotice(undefined);
    const res = await resendEmailChangeCodeAction({ locale });
    setBusy(null);
    if (res.data) {
      setNotice(t("resent"));
      router.refresh();
    } else {
      setFormError(actionError(res.serverError));
      router.refresh();
    }
  }

  async function discard() {
    setBusy("discard");
    setFormError(undefined);
    setNotice(undefined);
    const res = await discardEmailChangeAction({});
    setBusy(null);
    if (res.data) router.refresh();
    else setFormError(actionError(res.serverError));
  }

  const codeField = register("code", {
    onChange: (e: { target: HTMLInputElement }) => applyCode(e.target.value, e.target),
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5"
      data-testid="email-code-form"
    >
      <div className="flex flex-col gap-1">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-heading font-semibold text-balance focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t("pendingHeading")}
        </h2>
        <p className="text-small text-muted-foreground">
          {t("pendingBody", { address: pending.addressMasked, time: pending.until })}
        </p>
        <p className="text-small text-muted-foreground" data-testid="email-attempts-left">
          {t("attemptsLeft", { count: pending.attemptsLeft })}
        </p>
      </div>
      <FormAlert>{formError}</FormAlert>
      {/* Always rendered so assistive technology announces the text when it appears. */}
      <p role="status" className="text-small text-success empty:hidden" data-testid="email-notice">
        {notice}
      </p>
      <TextField
        label={t("code")}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        dir="ltr"
        className="text-center tracking-[0.4em]"
        error={errorText(errors.code?.message)}
        onPaste={onPaste}
        {...codeField}
      />
      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto sm:self-start">
        {isSubmitting ? t("confirming") : t("confirm")}
      </Button>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void resend()}
          disabled={busy !== null}
          className="w-full sm:w-auto"
        >
          {busy === "resend" ? t("resending") : t("resend")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void discard()}
          disabled={busy !== null}
          className="w-full sm:w-auto"
          data-testid="email-discard"
        >
          {busy === "discard" ? t("discarding") : t("discard")}
        </Button>
      </div>
    </form>
  );
}
