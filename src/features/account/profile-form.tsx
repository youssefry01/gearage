"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { profileSchema, type ProfileInput } from "@/domain/account";
import { accountRoutes } from "@/config/routes";
import { useAccountStateStore } from "./account-state-store";
import { Link, useRouter } from "@/i18n/navigation";
import {
  FormAlert,
  GenderSelect,
  PhoneField,
  phoneRegisterOptions,
  TextField,
  useErrorText,
} from "@/features/auth/form-fields";
import { zodResolver } from "@/features/auth/zod-resolver";
import { updateProfileAction } from "./account.actions";
import { useAccountActionError } from "./use-account-action-error";

export type ProfileFormValues = {
  firstName: string;
  lastName: string;
  /** Shown the way people write it (01012345678); stored as +20... */
  phone: string;
  /** YYYY-MM-DD or "". */
  dateOfBirth: string;
  gender: "male" | "female" | "";
  email: string;
};

/**
 * One form, one Save: name, mobile, date of birth and gender. The email is shown read-only, with a pointer to where it is
 * changed (Security, M5b-2b): that needs the password and a code sent to the new address, so it is not a field here.
 */
export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const t = useTranslations("Account.profile");
  const tf = useTranslations("Auth.fields");
  const router = useRouter();
  const errorText = useErrorText();
  const actionError = useAccountActionError();
  const [formError, setFormError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: initial.firstName,
      lastName: initial.lastName,
      phone: initial.phone,
      dateOfBirth: initial.dateOfBirth,
      gender: initial.gender || undefined,
    },
    mode: "onTouched",
  });

  // Closing or reloading the tab with unsaved edits asks first (in-app links are not guarded).
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    setSaved(false);
    const res = await updateProfileAction(values);
    if (res.data) {
      reset(getValues()); // what is on screen is now the saved state: nothing is unsaved
      setSaved(true);
      router.refresh(); // the greeting and the overview read the saved values
      void useAccountStateStore.getState().refresh(); // so does the name in the header
      return;
    }
    if (res.serverError?.field && res.serverError.issue) {
      setError(
        res.serverError.field as keyof ProfileInput,
        { message: res.serverError.issue },
        { shouldFocus: true },
      );
      return;
    }
    setFormError(actionError(res.serverError));
  });

  const err = (name: keyof ProfileInput) => errorText(errors[name]?.message);

  return (
    <form
      onSubmit={onSubmit}
      onChange={() => setSaved(false)}
      noValidate
      className="flex flex-col gap-5"
      data-testid="profile-form"
    >
      <FormAlert>{formError}</FormAlert>
      {saved ? (
        <p
          role="status"
          className="border-success text-success text-small rounded-control border px-3 py-2"
          data-testid="profile-saved"
        >
          {t("saved")}
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label={tf("firstName")}
          autoComplete="given-name"
          error={err("firstName")}
          {...register("firstName")}
        />
        <TextField
          label={tf("lastName")}
          autoComplete="family-name"
          error={err("lastName")}
          {...register("lastName")}
        />
      </div>
      <TextField
        label={tf("email")}
        name="email"
        type="email"
        autoComplete="email"
        spellCheck={false}
        dir="ltr"
        readOnly
        defaultValue={initial.email}
        className="bg-muted"
        hint={
          <>
            {t("emailHint")}{" "}
            <Link
              href={accountRoutes.security}
              className="text-link hover:text-link-hover inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            >
              {t("emailHintLink")}
            </Link>
          </>
        }
      />
      <PhoneField error={err("phone")} {...register("phone", phoneRegisterOptions)} />
      <TextField
        label={t("dateOfBirth")}
        type="date"
        autoComplete="bday"
        dir="ltr"
        error={err("dateOfBirth")}
        {...register("dateOfBirth")}
      />
      <GenderSelect {...register("gender")} />
      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto sm:self-start">
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
