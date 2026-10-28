import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { COMPARE_MAX } from "@/domain/compare";
import { Link } from "@/i18n/navigation";

/** "Nothing to compare yet": how to start a comparison. Shared by the server page and the client redirect helper. */
export function CompareEmptyCard() {
  const t = useTranslations("Compare");
  return (
    <section
      aria-labelledby="compare-empty-title"
      className="border-border rounded-panel flex flex-col items-start gap-3 border p-6"
      data-testid="compare-empty"
    >
      <h2 id="compare-empty-title" className="text-heading font-semibold">
        {t("emptyTitle")}
      </h2>
      <p className="text-muted-foreground max-w-prose">{t("emptyBody", { max: COMPARE_MAX })}</p>
      <Link href={routes.search} className={buttonStyles()}>
        {t("emptyCta")}
      </Link>
    </section>
  );
}
