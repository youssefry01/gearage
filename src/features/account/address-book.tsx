"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/locales";
import { useRouter } from "@/i18n/navigation";
import { FormAlert } from "@/features/auth/form-fields";
import { AddressForm, emptyAddressValues, type AddressFormValues } from "./address-form";
import { deleteAddressAction, setDefaultAddressAction } from "./address.actions";
import { useAccountActionError } from "./use-account-action-error";

/** An address as the page shows it: text already formatted for the page language on the server. */
export type AddressCard = {
  id: string;
  isDefault: boolean;
  /** Nickname when there is one, otherwise the recipient's name. */
  title: string;
  /** Shown under the title when a nickname is the title. */
  recipient: string | null;
  phone: string;
  lines: string[];
  values: AddressFormValues;
};

type Mode = { kind: "list" } | { kind: "add" } | { kind: "edit"; id: string };

/**
 * The address book page body (M5b-2c, ADR 0029). The add and edit form opens in place above the list, so there is no
 * second page to lose your place on; the result of every action is announced in one always-present polite live region
 * and focus is put back deliberately (the list heading after a save or a delete, the button after a cancelled delete),
 * because the button that was pressed can be gone after the refresh. Deleting asks first, inline.
 */
export function AddressBook({
  locale,
  cards,
  max,
  defaults,
}: {
  locale: Locale;
  cards: AddressCard[];
  max: number;
  defaults: Pick<AddressFormValues, "recipientName" | "phone">;
}) {
  const t = useTranslations("Account.addresses");
  const router = useRouter();
  const actionError = useAccountActionError();
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<string>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const deleteButtons = useRef(new Map<string, HTMLButtonElement>());
  const keepButtons = useRef(new Map<string, HTMLButtonElement>());
  const atLimit = cards.length >= max;
  const editing = mode.kind === "edit" ? cards.find((c) => c.id === mode.id) : undefined;

  function done(message: string) {
    setMode({ kind: "list" });
    setConfirming(null);
    setError(undefined);
    setNotice(message);
    router.refresh();
    // The pressed button may not exist after the refresh: keep keyboard focus on the list heading.
    queueMicrotask(() => headingRef.current?.focus());
  }

  async function makeDefault(id: string) {
    setBusy(id);
    setError(undefined);
    setNotice("");
    const res = await setDefaultAddressAction({ addressId: id });
    setBusy(null);
    if (res.data) done(t("defaultSet"));
    else setError(actionError(res.serverError) ?? t("failed"));
  }

  async function remove(id: string) {
    setBusy(id);
    setError(undefined);
    setNotice("");
    const res = await deleteAddressAction({ addressId: id });
    setBusy(null);
    if (res.data) done(t("deleted"));
    else {
      setConfirming(null);
      setError(actionError(res.serverError) ?? t("failed"));
    }
  }

  function askDelete(id: string) {
    setConfirming(id);
    // The safe choice gets focus: Enter by reflex keeps the address.
    queueMicrotask(() => keepButtons.current.get(id)?.focus());
  }

  function cancelDelete(id: string) {
    setConfirming(null);
    queueMicrotask(() => deleteButtons.current.get(id)?.focus());
  }

  return (
    <div className="flex flex-col gap-5">
      <p role="status" aria-live="polite" data-testid="address-notice" className="sr-only">
        {notice}
      </p>
      {notice ? (
        <p
          aria-hidden="true"
          className="border-success text-success text-small rounded-control border px-3 py-2"
        >
          {notice}
        </p>
      ) : null}
      <FormAlert>{error}</FormAlert>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-heading font-semibold text-balance outline-none"
        >
          {t("listLabel")}
        </h2>
        {mode.kind === "list" && !atLimit && cards.length > 0 ? (
          <Button
            ref={addRef}
            onClick={() => {
              setNotice("");
              setError(undefined);
              setMode({ kind: "add" });
            }}
            data-testid="address-add"
          >
            {t("add")}
          </Button>
        ) : null}
      </div>

      {atLimit && mode.kind === "list" ? (
        <p className="text-small text-muted-foreground" data-testid="address-limit">
          {t("limitReached", { max })}
        </p>
      ) : null}

      {mode.kind === "add" ? (
        <AddressForm
          locale={locale}
          mode="add"
          initial={emptyAddressValues(defaults)}
          showMakeDefault={cards.length > 0}
          onSaved={() => done(t("added"))}
          onCancel={() => setMode({ kind: "list" })}
        />
      ) : null}
      {mode.kind === "edit" && editing ? (
        <AddressForm
          key={editing.id}
          locale={locale}
          mode="edit"
          addressId={editing.id}
          initial={editing.values}
          showMakeDefault={false}
          onSaved={() => done(t("saved"))}
          onCancel={() => setMode({ kind: "list" })}
        />
      ) : null}

      {cards.length === 0 && mode.kind === "list" ? (
        <div
          className="border-border bg-card rounded-panel flex flex-col items-start gap-3 border p-6"
          data-testid="address-empty"
        >
          <MapPin aria-hidden="true" className="text-muted-foreground size-8" />
          <p className="font-semibold">{t("empty")}</p>
          <p className="text-small text-muted-foreground">{t("emptyHint")}</p>
          <Button onClick={() => setMode({ kind: "add" })} data-testid="address-add">
            {t("addFirst")}
          </Button>
        </div>
      ) : null}

      {cards.length > 0 ? (
        <ul
          aria-labelledby={undefined}
          aria-label={t("listLabel")}
          className="grid gap-4 lg:grid-cols-2"
        >
          {cards.map((card) => (
            <li
              key={card.id}
              data-testid="address-card"
              className="border-border bg-card rounded-panel flex min-w-0 flex-col gap-3 border p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold break-words">{card.title}</h3>
                {card.isDefault ? (
                  <span
                    data-testid="address-default-badge"
                    className="border-primary text-small rounded-control border px-2 py-0.5 font-semibold"
                  >
                    {t("defaultBadge")}
                  </span>
                ) : null}
              </div>
              <address className="flex flex-col gap-0.5 not-italic">
                {card.recipient ? <span className="font-medium">{card.recipient}</span> : null}
                <bdi dir="ltr" translate="no" className="text-muted-foreground text-start">
                  {card.phone}
                </bdi>
                {card.lines.map((line, i) => (
                  <span key={i} className="break-words">
                    {line}
                  </span>
                ))}
              </address>
              {confirming === card.id ? (
                <div role="group" aria-label={t("deleteQuestion")} className="flex flex-col gap-2">
                  <p className="font-semibold">{t("deleteQuestion")}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      ref={(el) => {
                        if (el) keepButtons.current.set(card.id, el);
                        else keepButtons.current.delete(card.id);
                      }}
                      onClick={() => cancelDelete(card.id)}
                    >
                      {t("deleteCancel")}
                    </Button>
                    <Button
                      disabled={busy === card.id}
                      onClick={() => void remove(card.id)}
                      data-testid="address-delete-confirm"
                    >
                      {t("deleteConfirm")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setNotice("");
                      setError(undefined);
                      setMode({ kind: "edit", id: card.id });
                    }}
                    data-testid="address-edit"
                  >
                    {t("edit")}
                  </Button>
                  {!card.isDefault ? (
                    <Button
                      variant="secondary"
                      disabled={busy === card.id}
                      onClick={() => void makeDefault(card.id)}
                      data-testid="address-set-default"
                    >
                      {t("setDefault")}
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    ref={(el) => {
                      if (el) deleteButtons.current.set(card.id, el);
                      else deleteButtons.current.delete(card.id);
                    }}
                    onClick={() => askDelete(card.id)}
                    data-testid="address-delete"
                  >
                    {t("delete")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
