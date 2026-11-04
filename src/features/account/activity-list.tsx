import { getTranslations } from "next-intl/server";
import type { SecurityEventView } from "@/server/services/account.service";
import type { DevicePatterns } from "@/domain/device";
import { describeDevice } from "@/domain/device";
import type { Locale } from "@/i18n/locales";
import { formatDateTime } from "@/lib/format-datetime";

/** The newest security events: what happened and when. Sign-ins also say which device. Never an IP address. */
export async function ActivityList({
  locale,
  events,
  devicePatterns,
}: {
  locale: Locale;
  events: SecurityEventView[];
  devicePatterns: DevicePatterns;
}) {
  const t = await getTranslations({ locale, namespace: "Account.security.activity" });
  if (events.length === 0) return <p className="text-muted-foreground">{t("empty")}</p>;
  return (
    <ul
      aria-label={t("list")}
      className="divide-border flex flex-col divide-y"
      data-testid="activity-list"
    >
      {events.map((e) => (
        <li
          key={e.id}
          data-testid="activity-event"
          className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
        >
          <span className="min-w-0 font-medium break-words">
            {e.type === "SIGN_IN" && e.device
              ? t("events.SIGN_IN_ON", { device: describeDevice(e.device, devicePatterns) })
              : t(`events.${e.type}`)}
          </span>
          <time dateTime={e.createdAt.toISOString()} className="text-small text-muted-foreground">
            {formatDateTime(e.createdAt, locale)}
          </time>
        </li>
      ))}
    </ul>
  );
}
