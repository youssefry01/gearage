import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { accountRoutes } from "@/config/routes";
import { formatAddressLines, MAX_ADDRESSES } from "@/domain/address";
import { toLocalMobile } from "@/domain/auth";
import { accountMetadata } from "@/features/account/account-metadata";
import { AccountShell } from "@/features/account/account-shell";
import { AddressBook, type AddressCard } from "@/features/account/address-book";
import { requireSession } from "@/features/account/require-session";
import { routing } from "@/i18n/routing";
import { getProfile } from "@/server/services/account.service";
import { listAddresses } from "@/server/services/address.service";

/** Per-visitor page: it reads the session cookie, so it is never prerendered or cached (ADR 0024). */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale)
    ? accountMetadata(locale, "addresses", accountRoutes.addresses)
    : {};
}

export default async function AddressesPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await requireSession(locale, accountRoutes.addresses);
  const [profile, addresses] = await Promise.all([
    getProfile(session.user.id),
    listAddresses(session.user.id),
  ]);
  const t = await getTranslations({ locale, namespace: "Account.addresses" });
  const words = {
    floor: t("floorWord"),
    apartment: t("apartmentWord"),
    landmark: t("landmarkWord"),
  };

  const cards: AddressCard[] = addresses.map((a) => ({
    id: a.id,
    isDefault: a.isDefault,
    title: a.label ?? a.recipientName,
    recipient: a.label ? a.recipientName : null,
    phone: toLocalMobile(a.phone),
    lines: formatAddressLines(a, locale, words),
    values: {
      label: a.label ?? "",
      recipientName: a.recipientName,
      phone: toLocalMobile(a.phone),
      governorate: a.governorate,
      city: a.city,
      area: a.area,
      street: a.street,
      building: a.building,
      floor: a.floor ?? "",
      apartment: a.apartment ?? "",
      landmark: a.landmark ?? "",
    },
  }));

  return (
    <AccountShell
      locale={locale}
      current="addresses"
      title={t("title")}
      intro={t("intro", { max: MAX_ADDRESSES })}
    >
      <AddressBook
        locale={locale}
        cards={cards}
        max={MAX_ADDRESSES}
        defaults={{
          recipientName: `${profile.firstName} ${profile.lastName}`,
          phone: toLocalMobile(profile.phone),
        }}
      />
    </AccountShell>
  );
}
