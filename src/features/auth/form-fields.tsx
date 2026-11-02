"use client";

import { Check, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import type { ActionError } from "@/server/actions/client";

const inputClass =
  "border-input bg-background text-foreground placeholder:text-muted-foreground rounded-control " +
  "min-h-11 w-full border px-3 py-2 aria-invalid:border-danger";

/** Translated text for a validation or server code; unknown codes fall back to a generic message. */
export function useErrorText() {
  const t = useTranslations("Auth.errors");
  return (
    code: string | undefined,
    values?: Record<string, string | number>,
  ): string | undefined => {
    if (!code) return undefined;
    const translate = t as unknown as (
      key: string,
      values?: Record<string, string | number>,
    ) => string;
    return t.has(code as never) ? translate(code, values) : t("generic");
  };
}

/** Turns a failed action result into text for the form-level alert. */
export function useActionErrorText() {
  const errorText = useErrorText();
  return (error: ActionError | undefined): string => {
    if (!error) return errorText("generic")!;
    const minutes = Math.max(1, Math.ceil((error.retryAfterSec ?? 60) / 60));
    if (error.code === "RATE_LIMITED") {
      return errorText(error.issue === "locked" ? "locked" : "rate_limited", { minutes })!;
    }
    if (error.code === "UNAVAILABLE") return errorText("unavailable")!;
    if (error.code === "UNAUTHENTICATED") return errorText("invalid_credentials")!;
    return errorText(error.issue, { minutes }) ?? errorText("generic")!;
  };
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  ref?: Ref<HTMLInputElement>;
  children?: ReactNode;
  /** Rendered below the input, inside the field (strength meter). */
  below?: ReactNode;
};

/** Label + input + hint + error wired with aria-describedby and aria-invalid. Errors are announced (role="alert"). */
export function TextField({ label, error, hint, className, below, ref, ...props }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-semibold">
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={`${inputClass} ${className ?? ""}`}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-small text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {below}
      {error ? (
        <p id={errorId} role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Password input with a show/hide toggle (44px target, announces its state). */
export function PasswordField({ label, error, hint, below, ref, ...props }: FieldProps) {
  const t = useTranslations("Auth.fields");
  const id = useId();
  const [shown, setShown] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={ref}
          type={shown ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          className={`${inputClass} pe-12`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-pressed={shown}
          aria-label={shown ? t("hidePassword") : t("showPassword")}
          className="text-muted-foreground hover:text-foreground absolute inset-y-0 end-0 flex w-11 items-center justify-center"
        >
          {shown ? (
            <EyeOff aria-hidden className="size-5" />
          ) : (
            <Eye aria-hidden className="size-5" />
          )}
        </button>
      </div>
      {hint ? (
        <p id={hintId} className="text-small text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {below}
      {error ? (
        <p id={errorId} role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormAlert({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="border-danger text-danger text-small rounded-control border px-3 py-2"
    >
      {children}
    </p>
  );
}

/**
 * A checkbox whose real input is a transparent 44px target over a 20px visible box (the input itself is what a finger
 * hits, so it must be 44px). Focus and checked states are drawn on the visible box.
 */
export function Checkbox({
  children,
  error,
  errorId,
  ref,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  children: ReactNode;
  error?: boolean;
  errorId?: string;
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="flex min-h-11 items-start gap-1">
      <span className="relative size-11 shrink-0">
        <input
          type="checkbox"
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="peer absolute inset-0 size-full cursor-pointer opacity-0"
          {...props}
        />
        <span
          aria-hidden
          className="border-input bg-background peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-ring peer-aria-invalid:border-danger pointer-events-none absolute start-3 top-3 flex size-5 items-center justify-center rounded-sm border peer-focus-visible:ring-2 [&>svg]:hidden peer-checked:[&>svg]:block"
        >
          <Check className="text-primary-foreground size-4" />
        </span>
      </span>
      <label className="text-small flex min-h-11 flex-1 items-center py-2" htmlFor={props.id}>
        {children}
      </label>
    </div>
  );
}
