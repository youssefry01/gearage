import { getTranslations } from "next-intl/server";
import type { DevicePatterns } from "@/domain/device";
import type { Locale } from "@/i18n/locales";

/** The translated "{browser} on {os}" sentence patterns, read raw (they carry placeholders the domain function fills). */
export async function getDevicePatterns(locale: Locale): Promise<DevicePatterns> {
  const t = await getTranslations({ locale, namespace: "Account.devices" });
  return {
    both: t.raw("both") as string,
    browserOnly: t.raw("browserOnly") as string,
    osOnly: t.raw("osOnly") as string,
    unknown: t.raw("unknown") as string,
  };
}
