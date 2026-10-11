import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { brandVars } from "@/config/brand";
import { interpolateBrand } from "./brand-messages";
import { formats } from "./formats";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const fromUrl = await rootParams.locale();
    if (hasLocale(routing.locales, fromUrl)) locale = fromUrl;
    else notFound();
  }
  if (!hasLocale(routing.locales, locale)) notFound();

  const raw = (await import(`../../messages/${locale}.json`)).default;
  return {
    locale,
    messages: interpolateBrand(raw, brandVars(locale)),
    formats,
    timeZone: "Africa/Cairo",
  };
});
